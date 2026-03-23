import { PrismaClient } from '@prisma/client';
import { getGenDir } from './gen-dir.js';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

interface GenerationLog {
  timestamp?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface MigrationResult {
  total: number;
  migrated: number;
  cleanedDuplicates: number;
  alreadyMigrated: number;
  missing: number;
  errors: string[];
}

/**
 * Migrate timestamp-based folders to the new human-readable structure.
 * 
 * This script consolidates duplicate folders created during the transition
 * from timestamp-based to app-id-based folder naming.
 */
export async function migrateFolders(dryRun: boolean = false): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    cleanedDuplicates: 0,
    alreadyMigrated: 0,
    missing: 0,
    errors: [],
  };

  try {
    // Get all non-deleted applications
    const apps = await prisma.application.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        companyName: true,
        jobTitle: true,
        generationLog: true,
      },
    });

    result.total = apps.length;
    console.log(`[${dryRun ? 'DRY-RUN' : 'MIGRATION'}] Processing ${apps.length} applications`);

    for (const app of apps) {
      // Parse generationLog - it's stored as a JSON string, not an object
      let generationLog: GenerationLog = {};
      if (app.generationLog) {
        try {
          generationLog = typeof app.generationLog === 'string'
            ? JSON.parse(app.generationLog)
            : app.generationLog;
        } catch {
          console.log(`[SKIP] Invalid generationLog JSON: ${app.id}`);
          result.errors.push(`Invalid generationLog for app ${app.id}`);
          continue;
        }
      }

      const timestamp = generationLog?.timestamp;

      if (!timestamp) {
        // Applications without timestamp were likely created after the refactor
        result.alreadyMigrated++;
        continue;
      }

      // Convert ISO timestamp to milliseconds (like Date.now())
      const timestampMs = Math.floor(new Date(timestamp).getTime());
      const oldFolderName = timestampMs.toString();
      const oldFolderPath = path.join(process.cwd(), 'generated', oldFolderName);
      const newFolderPath = getGenDir(app);

      try {
        const oldExists = await fs.access(oldFolderPath).then(() => true).catch(() => false);
        const newExists = await fs.access(newFolderPath).then(() => true).catch(() => false);

        if (oldExists && !newExists) {
          // Migrate: move contents from old to new
          if (!dryRun) {
            await fs.mkdir(newFolderPath, { recursive: true });
            const items = await fs.readdir(oldFolderPath);
            for (const item of items) {
              const src = path.join(oldFolderPath, item);
              const dest = path.join(newFolderPath, item);
              await fs.copyFile(src, dest);
            }
            await fs.rm(oldFolderPath, { recursive: true });
          }
          result.migrated++;
          console.log(`  ${dryRun ? '[DRY] Would migrate' : '✓ Migrated'} ${app.id} from ${oldFolderName} to ${path.basename(newFolderPath)}`);
        } else if (oldExists && newExists) {
          // Both exist: keep new, delete old
          if (!dryRun) {
            await fs.rm(oldFolderPath, { recursive: true });
          }
          result.cleanedDuplicates++;
          console.log(`  ${dryRun ? '[DRY] Would remove' : '✓ Removed'} duplicate timestamp folder for ${app.id}`);
        } else if (!oldExists && !newExists) {
          result.missing++;
          console.log(`  ⊘ No folder found for ${app.id} (will be regenerated on demand)`);
        } else {
          result.alreadyMigrated++;
          console.log(`  ✓ Already using new structure for ${app.id}`);
        }
      } catch (err: any) {
        result.errors.push(`Error processing ${app.id}: ${err.message}`);
        console.error(`  ✗ Error processing ${app.id}:`, err.message);
      }
    }

    console.log(`\n${dryRun ? 'DRY-RUN ' : ''}Summary:`);
    console.log(`  Total applications: ${result.total}`);
    console.log(`  Migrated: ${result.migrated}`);
    console.log(`  Cleaned duplicates: ${result.cleanedDuplicates}`);
    console.log(`  Already migrated: ${result.alreadyMigrated}`);
    console.log(`  Missing folders: ${result.missing}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      result.errors.forEach(err => console.error('  -', err));
    }

    return result;
  } finally {
    await prisma.$disconnect();
  }
}

// Run as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log(`Starting folder migration ${dryRun ? '(dry-run mode)' : ''}...\n`);
  
  migrateFolders(dryRun)
    .then(result => {
      const errors = result.errors.length > 0 ? `\n⚠️  ${result.errors.length} errors occurred` : '\n✅ Migration completed successfully';
      console.log(errors);
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
