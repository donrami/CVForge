import { prisma } from '../../server.js';
import type { BackupData, BackupApplication } from './backup.js';

export interface RestoreResult {
  created: number;
  updated: number;
}

const VALID_STATUSES = ['GENERATED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'] as const;
const VALID_LANGUAGES = ['EN', 'DE'] as const;

const REQUIRED_FIELDS: (keyof BackupApplication)[] = [
  'id',
  'companyName',
  'jobTitle',
  'status',
  'targetLanguage',
  'createdAt',
  'updatedAt',
];

/** ISO 8601 date-time regex (e.g. 2024-01-15T10:30:00.000Z) */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isValidISODate(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  if (!ISO_8601_REGEX.test(value)) return false;
  return !isNaN(Date.parse(value));
}

/**
 * Validates that the given data conforms to the BackupData structure.
 * Throws an error with a descriptive message if validation fails.
 */
export function validateBackupFile(data: unknown): BackupData {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Backup file must be a JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.applications)) {
    throw new Error('Backup file must contain an applications array');
  }

  const applications = obj.applications as unknown[];

  for (let i = 0; i < applications.length; i++) {
    const app = applications[i];
    if (app === null || typeof app !== 'object' || Array.isArray(app)) {
      throw new Error(`Application at index ${i} must be an object`);
    }

    const record = app as Record<string, unknown>;

    // Check required fields exist and are strings
    for (const field of REQUIRED_FIELDS) {
      if (record[field] === undefined || record[field] === null) {
        throw new Error(`Application at index ${i} is missing required field: ${field}`);
      }
      if (typeof record[field] !== 'string') {
        throw new Error(`Application at index ${i} has invalid type for field: ${field}`);
      }
    }

    // Validate enum values
    if (!VALID_STATUSES.includes(record.status as any)) {
      throw new Error(
        `Application at index ${i} has invalid status: ${record.status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
      );
    }

    if (!VALID_LANGUAGES.includes(record.targetLanguage as any)) {
      throw new Error(
        `Application at index ${i} has invalid targetLanguage: ${record.targetLanguage}. Must be one of: ${VALID_LANGUAGES.join(', ')}`,
      );
    }

    // Validate required date fields (createdAt, updatedAt)
    if (!isValidISODate(record.createdAt)) {
      throw new Error(`Application at index ${i} has invalid createdAt date`);
    }
    if (!isValidISODate(record.updatedAt)) {
      throw new Error(`Application at index ${i} has invalid updatedAt date`);
    }

    // Validate optional date fields
    const optionalDateFields = ['appliedAt', 'interviewAt', 'offerAt', 'rejectedAt'] as const;
    for (const field of optionalDateFields) {
      if (record[field] !== undefined && !isValidISODate(record[field])) {
        throw new Error(`Application at index ${i} has invalid ${field} date`);
      }
    }
  }

  return data as BackupData;
}

/**
 * Restores applications from a validated backup into the database using
 * a Prisma transaction with upsert operations. Matches on `id` field.
 * Returns counts of created and updated records.
 */
export async function restoreFromBackup(backup: BackupData): Promise<RestoreResult> {
  // Look up which IDs already exist so we can count creates vs updates
  const existingIds = new Set(
    (
      await prisma.application.findMany({
        where: { id: { in: backup.applications.map((a) => a.id) } },
        select: { id: true },
      })
    ).map((a) => a.id),
  );

  let created = 0;
  let updated = 0;

  await prisma.$transaction(
    backup.applications.map((app) => {
      const isExisting = existingIds.has(app.id);
      if (isExisting) {
        updated++;
      } else {
        created++;
      }

      const data = {
        companyName: app.companyName,
        jobTitle: app.jobTitle,
        status: app.status as any,
        targetLanguage: app.targetLanguage as any,
        createdAt: new Date(app.createdAt),
        updatedAt: new Date(app.updatedAt),
        notes: app.notes ?? null,
        appliedAt: app.appliedAt ? new Date(app.appliedAt) : null,
        interviewAt: app.interviewAt ? new Date(app.interviewAt) : null,
        offerAt: app.offerAt ? new Date(app.offerAt) : null,
        rejectedAt: app.rejectedAt ? new Date(app.rejectedAt) : null,
        deletedAt: null,
        // Required fields with sensible defaults for create
        jobDescription: '',
        latexOutput: '',
        generationLog: {},
      };

      return prisma.application.upsert({
        where: { id: app.id },
        create: { id: app.id, ...data },
        update: data,
      });
    }),
  );

  return { created, updated };
}
