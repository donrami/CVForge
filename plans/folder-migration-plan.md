# Folder Structure Migration Plan

## Goal
Consolidate duplicate generated folders into a single unified structure using `getGenDir(app)` pattern.

## Current State
- **71 timestamp folders**: `generated/1773877244063/`, `generated/1773877297757/`, etc.
- **~40 human-readable folders**: `generated/cmmtvjqbd0000wondxo9ge1tt/`, etc.
- Each CV currently has 2 folders (one timestamp, one human-readable) because the download endpoint creates a new folder when it doesn't find the timestamp folder.

## Target State
- **One folder per CV**: `generated/{appId}-{sanitizedCompany}-{sanitizedJobTitle}/`
- All files (cv.tex, cv.pdf, profile.png) in that single folder
- Old timestamp folders are migrated or cleaned up

## Migration Strategy: Automated Migration (Preserve Existing Files)

### Steps:

1. **Query database** to get all non-deleted applications with:
   - `id`
   - `companyName`
   - `jobTitle`
   - `generationLog` (contains `timestamp` field with ISO date)

2. **For each application**:
   - Calculate the expected timestamp folder name from `generationLog.timestamp`:
     - Parse ISO string → Date → `Date.now()` equivalent (milliseconds)
   - Check if that timestamp folder exists in `generated/`
   - If it exists AND the new human-readable folder doesn't exist:
     - Create new folder using `getGenDir(app)` pattern
     - Move all contents from timestamp folder to new folder
     - Delete old timestamp folder
   - If both exist: keep human-readable, delete timestamp (data already there)
   - If only human-readable exists: nothing to do
   - If only timestamp exists but migration failed: log error, leave for manual review

3. **Update `restore.ts`**:
   - After restoring an application, ensure its folder exists by calling `getGenDir(app)`
   - If folder doesn't exist, recreate it with the LaTeX content from backup

4. **Run tests** to verify the changes don't break functionality

5. **Execute migration script** with dry-run first, then actual run

## Files to Modify

### New Files:
- `server/utils/migrate-folders.ts` - Migration script (can be run standalone)

### Modified Files:
- `server/services/restore.ts` - Ensure folder exists after restore
- `server/services/__tests__/migration.test.ts` - Test migration logic

## Migration Script Logic

```typescript
import { PrismaClient } from '@prisma/client';
import { getGenDir } from '../utils/gen-dir.js';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function migrate() {
  const apps = await prisma.application.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      companyName: true,
      jobTitle: true,
      generationLog: true,
    },
  });

  console.log(`Found ${apps.length} applications to process`);

  for (const app of apps) {
    const genLog = app.generationLog as any;
    if (!genLog?.timestamp) {
      console.warn(`App ${app.id} missing timestamp in generationLog, skipping`);
      continue;
    }

    // Convert ISO timestamp to milliseconds (like Date.now())
    const timestampMs = Math.floor(new Date(genLog.timestamp).getTime());
    const oldFolderName = timestampMs.toString();
    const oldFolderPath = path.join(process.cwd(), 'generated', oldFolderName);

    const newFolderPath = getGenDir(app);

    try {
      const oldExists = await fs.access(oldFolderPath).then(() => true).catch(() => false);
      const newExists = await fs.access(newFolderPath).then(() => true).catch(() => false);

      if (oldExists && !newExists) {
        // Migrate: move contents from old to new
        await fs.mkdir(newFolderPath, { recursive: true });
        const items = await fs.readdir(oldFolderPath);
        for (const item of items) {
          const src = path.join(oldFolderPath, item);
          const dest = path.join(newFolderPath, item);
          await fs.copyFile(src, dest);
        }
        await fs.rm(oldFolderPath, { recursive: true });
        console.log(`✓ Migrated ${app.id} from ${oldFolderName} to new structure`);
      } else if (oldExists && newExists) {
        // Both exist: keep new, delete old
        await fs.rm(oldFolderPath, { recursive: true });
        console.log(`✓ Cleaned up duplicate timestamp folder for ${app.id}`);
      } else if (!oldExists && !newExists) {
        console.log(`⊘ No folder found for ${app.id} (will be regenerated on demand)`);
      } else {
        console.log(`✓ Already using new structure for ${app.id}`);
      }
    } catch (err) {
      console.error(`✗ Error processing ${app.id}:`, err);
    }
  }

  await prisma.$disconnect();
}

migrate().catch(console.error);
```

## Testing Checklist

- [ ] Migration script correctly identifies timestamp folders
- [ ] Files are copied without corruption
- [ ] Old folders are removed after successful migration
- [ ] No data loss during migration
- [ ] PDF downloads work after migration
- [ ] Restore functionality recreates folders correctly
- [ ] Tests pass: `bun test`

## Rollback Plan

If something goes wrong:
1. The migration script can be re-run - it's idempotent
2. Database remains untouched
3. If files were deleted incorrectly, they can be regenerated from `latexOutput` on PDF download
4. Git history preserves the migration script for audit
