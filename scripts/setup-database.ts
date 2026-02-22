#!/usr/bin/env npx tsx
/**
 * ForemanOS Database Setup Script
 *
 * This script automates the database setup process:
 * 1. Validates environment variables
 * 2. Tests database connection
 * 3. Runs migrations or pushes schema
 * 4. Creates initial admin user (optional)
 *
 * Usage:
 *   npx tsx scripts/setup-database.ts
 *   npm run setup:database
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, message: string) {
  log(`\n[${step}/5] ${message}`, 'cyan');
}

function logSuccess(message: string) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`  ✗ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`  ⚠ ${message}`, 'yellow');
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function validateEnvironment(): Promise<boolean> {
  logStep(1, 'Validating environment variables...');

  const required = ['DATABASE_URL'];
  const recommended = ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
  const optional = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AWS_BUCKET_NAME'];

  let hasErrors = false;

  // Check required
  for (const envVar of required) {
    if (process.env[envVar]) {
      logSuccess(`${envVar} is set`);
    } else {
      logError(`${envVar} is MISSING (required)`);
      hasErrors = true;
    }
  }

  // Check recommended
  for (const envVar of recommended) {
    if (process.env[envVar]) {
      logSuccess(`${envVar} is set`);
    } else {
      logWarning(`${envVar} is not set (recommended for production)`);
    }
  }

  // Check optional
  const setOptional = optional.filter(v => process.env[v]);
  if (setOptional.length > 0) {
    logSuccess(`Optional services configured: ${setOptional.join(', ')}`);
  } else {
    logWarning('No optional services configured (AI, S3)');
  }

  return !hasErrors;
}

async function testDatabaseConnection(): Promise<boolean> {
  logStep(2, 'Testing database connection...');

  try {
    await prisma.$connect();
    logSuccess('Database connection successful');

    // Test query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    logSuccess('Database query successful');

    return true;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logError(`Database connection failed: ${errMsg}`);

    if (errMsg.includes('ECONNREFUSED')) {
      log('    Hint: Is your database server running?', 'yellow');
    } else if (errMsg.includes('authentication')) {
      log('    Hint: Check your database credentials in DATABASE_URL', 'yellow');
    } else if (errMsg.includes('does not exist')) {
      log('    Hint: The database may need to be created first', 'yellow');
    }

    return false;
  }
}

async function checkExistingSchema(): Promise<{ hasSchema: boolean; tableCount: number }> {
  logStep(3, 'Checking existing schema...');

  try {
    const tables = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    const tableCount = Number(tables[0]?.count || 0);

    if (tableCount > 0) {
      logSuccess(`Found ${tableCount} existing tables`);
      return { hasSchema: true, tableCount };
    } else {
      logWarning('No tables found - database is empty');
      return { hasSchema: false, tableCount: 0 };
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logWarning(`Could not check schema: ${errMsg}`);
    return { hasSchema: false, tableCount: 0 };
  }
}

async function applySchema(force: boolean = false): Promise<boolean> {
  logStep(4, 'Applying database schema...');

  const { hasSchema, tableCount } = await checkExistingSchema();

  if (hasSchema && !force) {
    log(`\n  Database already has ${tableCount} tables.`, 'yellow');
    const answer = await prompt('  Do you want to reset and recreate? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
      logSuccess('Keeping existing schema');
      return true;
    }
  }

  try {
    // Use Prisma to push schema
    const { execSync } = await import('child_process');

    log('  Running prisma db push...', 'blue');
    execSync('npx prisma db push --accept-data-loss', {
      stdio: 'inherit',
      env: process.env,
    });

    logSuccess('Schema applied successfully');
    return true;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logError(`Schema push failed: ${errMsg}`);
    return false;
  }
}

async function createAdminUser(): Promise<boolean> {
  logStep(5, 'Admin user setup...');

  // Check if any users exist
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    logSuccess(`Found ${userCount} existing user(s)`);
    const answer = await prompt('  Create another admin user? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
      return true;
    }
  }

  // Get user details
  const email = await prompt('  Enter admin email: ');
  const username = await prompt('  Enter admin username: ');
  const password = await prompt('  Enter admin password: ');

  if (!email || !username || !password) {
    logWarning('Skipping admin user creation (missing details)');
    return true;
  }

  try {
    // Hash password using bcrypt pattern
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: 'admin',
        approved: true,
        emailVerified: true,
        subscriptionTier: 'enterprise',
      },
    });

    logSuccess(`Admin user created: ${user.email}`);
    return true;
  } catch (error: unknown) {
    const errCode = error instanceof Object && 'code' in error ? (error as { code?: string }).code : undefined;
    if (errCode === 'P2002') {
      logError('User with that email or username already exists');
    } else {
      const errMsg = error instanceof Error ? error.message : String(error);
      logError(`Failed to create user: ${errMsg}`);
    }
    return false;
  }
}

async function printSummary() {
  log('\n' + '='.repeat(50), 'cyan');
  log('Database Setup Complete!', 'green');
  log('='.repeat(50), 'cyan');

  const userCount = await prisma.user.count();
  const projectCount = await prisma.project.count();

  log(`\nCurrent database stats:`);
  log(`  • Users: ${userCount}`);
  log(`  • Projects: ${projectCount}`);

  log(`\nNext steps:`);
  log(`  1. Set remaining environment variables (see VERCEL_SETUP_GUIDE.md)`);
  log(`  2. Run 'npm run dev' to start development server`);
  log(`  3. Or run 'vercel --prod' to deploy to production`);
  log('');
}

async function main() {
  log('\n' + '='.repeat(50), 'cyan');
  log('ForemanOS Database Setup', 'cyan');
  log('='.repeat(50), 'cyan');

  try {
    // Step 1: Validate environment
    const envValid = await validateEnvironment();
    if (!envValid) {
      log('\nPlease set required environment variables and try again.', 'red');
      process.exit(1);
    }

    // Step 2: Test connection
    const connected = await testDatabaseConnection();
    if (!connected) {
      log('\nPlease fix database connection and try again.', 'red');
      process.exit(1);
    }

    // Step 3 & 4: Check and apply schema
    const schemaApplied = await applySchema();
    if (!schemaApplied) {
      log('\nSchema setup failed. Please check errors above.', 'red');
      process.exit(1);
    }

    // Step 5: Create admin user
    await createAdminUser();

    // Summary
    await printSummary();

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logError(`Unexpected error: ${errMsg}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
