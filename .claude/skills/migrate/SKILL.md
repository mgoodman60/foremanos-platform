---
name: migrate
description: Database migration helper
---

Help with Prisma database migrations.

## Usage

- `/migrate` - Check migration status
- `/migrate create` - Create new migration
- `/migrate apply` - Apply pending migrations
- `/migrate reset` - Reset database (dev only)

## Commands

```bash
# Check status
npx prisma migrate status

# Create migration (dev)
npx prisma migrate dev --name $ARGUMENTS

# Apply migrations (prod)
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Regenerate client
npx prisma generate
```

## Migration Process

1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description`
3. Review generated SQL
4. Test locally
5. Commit migration files
6. Apply with `npx prisma migrate deploy` in prod

## Common Issues

| Issue | Solution |
|-------|----------|
| Client outdated | `npx prisma generate` |
| Migration conflict | `npx prisma migrate resolve` |
| Schema drift | `npx prisma db push` (dev) |
