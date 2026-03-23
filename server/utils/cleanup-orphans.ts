import { PrismaClient } from '@prisma/client';
import { getGenDir } from './gen-dir.js';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

interface CleanupResult {
  totalFolders: number;
  validFolders: number;
  orphanFolders: string[];
  errors: string[];
}

export async function cleanupOrphans(dryRun: boolean = true): Promise<CleanupResult> {
  const result: CleanupResult = {
    totalFolders: 0,
    validFolders: 0,
    orphanFolders: [],
    errors: [],
  };

  // 1. Get all application IDs
  const apps = await prisma.application.findMany({
    where: { deletedAt: null },
    select: { id: true, companyName: true, jobTitle: true },
  });

  const validAppIds = new Set(apps.map(a => a.id));
  
  // 2. Compute expected folder names for validation
  const validFolderNames = new Set(
    apps.map(app => path.basename(getGenDir(app)))
  );

  // 3. List all folders in generated/
  const generatedDir = path.join(process.cwd(), 'generated');
  const entries = await fs.readdir(generatedDir, { withFileTypes: true });
  const folders = entries.filter(e => e.isDirectory()).map(e => e.name);

  result.totalFolders = folders.length;
  console.log(`[${dryRun ? 'DRY-RUN' : 'CLEANUP'}] Found ${folders.length} folders, ${apps.length} applications\n`);

  // 4. Classify each folder
  for (const folder of folders) {
    if (validFolderNames.has(folder)) {
      result.validFolders++;
      console.log(`  ✓ KEEP: ${folder}`);
    } else if (/^\d+$/.test(folder)) {
      // Pure timestamp folder
      result.orphanFolders.push(folder);
      console.log(`  ✗ ORPHAN [timestamp]: ${folder}`);
    } else {
      // Extract prefix (before first `-`) and check if it's a valid app ID
      const prefix = folder.split('-')[0];
      
      // Check if folder might be a valid folder with truncated suffix
      // by seeing if any valid folder name starts with this prefix
      const isPartialMatch = Array.from(validFolderNames).some(name => name.startsWith(prefix + '-') || name === prefix);
      if (prefix.length >= 20 && isPartialMatch) {
        // Partial match - might be a valid folder with truncated suffix
        result.validFolders++;
        console.log(`  ✓ KEEP (partial match): ${folder}`);
      } else {
        result.orphanFolders.push(folder);
        console.log(`  ✗ ORPHAN [no match]: ${folder}`);
      }
    }
  }

  // 5. Delete orphans if not dry-run
  if (!dryRun && result.orphanFolders.length > 0) {
    console.log(`\nDeleting ${result.orphanFolders.length} orphan folders...`);
    for (const folder of result.orphanFolders) {
      const folderPath = path.join(generatedDir, folder);
      try {
        await fs.rm(folderPath, { recursive: true });
        console.log(`  ✓ Deleted: ${folder}`);
      } catch (err: any) {
        result.errors.push(`Failed to delete ${folder}: ${err.message}`);
        console.error(`  ✗ Failed: ${folder} - ${err.message}`);
      }
    }
  }

  // Summary
  console.log(`\n${dryRun ? 'DRY-RUN ' : ''}Summary:`);
  console.log(`  Total folders: ${result.totalFolders}`);
  console.log(`  Valid (to keep): ${result.validFolders}`);
  console.log(`  Orphan (to delete): ${result.orphanFolders.length}`);
  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.length}`);
  }

  return result;
}

// Run as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = !process.argv.includes('--execute');
  
  console.log(`Orphan folder cleanup ${dryRun ? '(dry-run mode - no changes will be made)' : '(EXECUTE mode)'}\n`);
  
  cleanupOrphans(dryRun)
    .then(result => {
      if (result.orphanFolders.length === 0) {
        console.log('\n✅ No orphan folders found');
      } else if (dryRun) {
        console.log('\n💡 Run with --execute to delete orphan folders');
      } else {
        console.log('\n✅ Cleanup completed');
      }
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
