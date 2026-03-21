import { prisma } from '../../server.js';
import type { JobStatus, Language } from '@prisma/client';
import { logger } from './logger.js';

export interface CreateJobInput {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  targetLanguage: Language;
  additionalContext?: string;
  parentId?: string;
}

export interface JobProgress {
  phase: 'preparing' | 'ai-working' | 'finalizing';
  aiChars: number;
}

/**
 * Create a new generation job in the database.
 */
export async function createJob(input: CreateJobInput) {
  return prisma.generationJob.create({
    data: {
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
      targetLanguage: input.targetLanguage,
      additionalContext: input.additionalContext,
      parentId: input.parentId,
      status: 'PENDING',
      aiChars: 0,
    },
  });
}

/**
 * Update job status to PROCESSING.
 */
export async function startJob(jobId: string) {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' },
  });
}

/**
 * Update job progress (phase and character count).
 */
export async function updateJobProgress(jobId: string, progress: JobProgress) {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      phase: progress.phase,
      aiChars: progress.aiChars,
    },
  });
}

/**
 * Mark job as completed with the resulting application ID.
 */
export async function completeJob(jobId: string, applicationId: string) {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      applicationId,
      phase: 'finalizing',
    },
  });
}

/**
 * Mark job as failed with an error message.
 */
export async function failJob(jobId: string, error: string) {
  logger.error({ jobId, error }, 'Generation job failed');
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      error,
    },
  });
}

/**
 * Get a job by ID.
 */
export async function getJob(jobId: string) {
  return prisma.generationJob.findUnique({
    where: { id: jobId },
  });
}

/**
 * Get all active (non-terminal) jobs.
 */
export async function getActiveJobs() {
  return prisma.generationJob.findMany({
    where: {
      status: {
        in: ['PENDING', 'PROCESSING'],
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get jobs with minimal info for list endpoint.
 */
export async function getActiveJobsSummary() {
  const jobs = await getActiveJobs();
  return jobs.map((job) => ({
    id: job.id,
    status: job.status,
    companyName: job.companyName,
    jobTitle: job.jobTitle,
    createdAt: job.createdAt,
  }));
}
