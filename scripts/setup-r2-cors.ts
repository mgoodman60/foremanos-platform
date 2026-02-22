#!/usr/bin/env npx tsx
/**
 * ForemanOS R2 CORS Setup Script
 *
 * This script applies CORS rules to the R2 bucket for presigned URL uploads.
 * It configures the bucket to accept PUT requests from ForemanOS domains.
 *
 * Usage:
 *   npx tsx scripts/setup-r2-cors.ts
 *
 * Environment variables required:
 *   - S3_ENDPOINT
 *   - AWS_ACCESS_KEY_ID
 *   - AWS_SECRET_ACCESS_KEY
 *   - AWS_BUCKET_NAME
 *   - CORS_EXTRA_ORIGINS (optional, comma-separated)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig, validateS3Config } from '../lib/aws-config';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
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

function buildOriginsList(): string[] {
  const baseOrigins = [
    'https://foremanos.vercel.app',
    'http://localhost:3000',
  ];

  // Add any extra origins from environment
  const extraOrigins = process.env.CORS_EXTRA_ORIGINS;
  if (extraOrigins) {
    const parsed = extraOrigins.split(',').map(o => o.trim()).filter(Boolean);
    return [...baseOrigins, ...parsed];
  }

  return baseOrigins;
}

async function applyCorsRules(): Promise<boolean> {
  const { bucketName } = getBucketConfig();
  const origins = buildOriginsList();

  try {
    const client = createS3Client();

    log('\nApplying CORS rules to bucket...', 'cyan');
    log(`  Bucket: ${bucketName}`);
    log(`  Origins: ${origins.join(', ')}`);

    const corsConfig = {
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            AllowedOrigins: origins,
            ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    };

    await client.send(new PutBucketCorsCommand(corsConfig));
    logSuccess('CORS rules applied successfully');

    return true;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logError(`Failed to apply CORS rules: ${errMsg}`);
    const errCode = error instanceof Object && 'Code' in error ? (error as { Code?: string }).Code : undefined;
    if (errCode) {
      log(`    Error code: ${errCode}`, 'yellow');
    }
    return false;
  }
}

async function verifyCorsRules(): Promise<boolean> {
  const { bucketName } = getBucketConfig();

  try {
    const client = createS3Client();

    log('\nVerifying CORS configuration...', 'cyan');

    const response = await client.send(
      new GetBucketCorsCommand({ Bucket: bucketName })
    );

    if (response.CORSRules && response.CORSRules.length > 0) {
      logSuccess('CORS rules verified');

      for (const [index, rule] of response.CORSRules.entries()) {
        log(`\n  Rule ${index + 1}:`);
        log(`    Methods: ${rule.AllowedMethods?.join(', ')}`);
        log(`    Headers: ${rule.AllowedHeaders?.join(', ')}`);
        log(`    Origins: ${rule.AllowedOrigins?.join(', ')}`);
        log(`    Expose: ${rule.ExposeHeaders?.join(', ')}`);
        log(`    MaxAge: ${rule.MaxAgeSeconds}s`);
      }

      return true;
    } else {
      logWarning('No CORS rules found after applying');
      return false;
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logError(`Failed to verify CORS rules: ${errMsg}`);
    return false;
  }
}

async function main() {
  log('\n' + '='.repeat(50), 'cyan');
  log('ForemanOS R2 CORS Setup', 'cyan');
  log('='.repeat(50), 'cyan');

  try {
    // Step 1: Validate environment
    log('\n[1/3] Validating S3 configuration...', 'cyan');
    const validation = validateS3Config();

    if (!validation.valid) {
      logError('Missing required environment variables:');
      for (const missing of validation.missing) {
        log(`    - ${missing}`, 'red');
      }
      log('\nPlease set these environment variables and try again.', 'red');
      process.exit(1);
    }

    logSuccess('All required environment variables are set');

    // Step 2: Apply CORS rules
    log('\n[2/3] Applying CORS configuration...', 'cyan');
    const applied = await applyCorsRules();

    if (!applied) {
      log('\nFailed to apply CORS rules. Please check errors above.', 'red');
      process.exit(1);
    }

    // Step 3: Verify CORS rules
    log('\n[3/3] Verifying CORS configuration...', 'cyan');
    const verified = await verifyCorsRules();

    if (!verified) {
      log('\nFailed to verify CORS rules. Please check errors above.', 'red');
      process.exit(1);
    }

    // Success summary
    log('\n' + '='.repeat(50), 'cyan');
    log('CORS Setup Complete!', 'green');
    log('='.repeat(50), 'cyan');
    log('\nYour R2 bucket is now configured for presigned URL uploads.', 'green');
    log('');

    process.exit(0);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logError(`\nUnexpected error: ${errMsg}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
