import { prisma } from '../../server.js';
import { getGenDir } from '../utils/gen-dir.js';

export interface BackupApplication {
  id: string;
  companyName: string;
  jobTitle: string;
  status: string;
  targetLanguage: string;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  appliedAt: string | null;
  interviewAt: string | null;
  offerAt: string | null;
  rejectedAt: string | null;
  genDir: string; // Path to generated folder for this application
}

export interface BackupData {
  version: string;
  exportedAt: string;
  applications: BackupApplication[];
}

export async function generateBackup(): Promise<BackupData> {
  const applications = await prisma.application.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      companyName: true,
      jobTitle: true,
      status: true,
      targetLanguage: true,
      createdAt: true,
      updatedAt: true,
      notes: true,
      appliedAt: true,
      interviewAt: true,
      offerAt: true,
      rejectedAt: true,
    },
  });

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    applications: applications.map((app) => ({
      id: app.id,
      companyName: app.companyName,
      jobTitle: app.jobTitle,
      status: app.status,
      targetLanguage: app.targetLanguage,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      notes: app.notes,
      appliedAt: app.appliedAt?.toISOString() ?? null,
      interviewAt: app.interviewAt?.toISOString() ?? null,
      offerAt: app.offerAt?.toISOString() ?? null,
      rejectedAt: app.rejectedAt?.toISOString() ?? null,
      genDir: getGenDir(app), // Include the generated folder path for restore
    })),
  };
}
