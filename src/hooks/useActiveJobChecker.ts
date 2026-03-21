import { useEffect, useCallback, useRef } from 'react';
import { fetchActiveJobs, JobInfo } from './useJobStatus';

/**
 * Hook that monitors for completed jobs that may have been
 * processed while the user was away from the page.
 * 
 * Stores the last known job IDs in sessionStorage to detect
 * when new jobs complete.
 */
export function useActiveJobChecker(
  onJobCompleted: (job: JobInfo) => void,
  pollInterval: number = 5000
) {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const knownJobsRef = useRef<Set<string>>(new Set());

  const checkForCompletedJobs = useCallback(async () => {
    try {
      const jobs = await fetchActiveJobs();
      
      // Find jobs that were previously known but are no longer active
      // (meaning they completed or failed)
      for (const jobId of knownJobsRef.current) {
        const stillActive = jobs.some(j => j.id === jobId);
        if (!stillActive) {
          // Job is no longer active - fetch full details
          const response = await fetch(`/api/jobs/${jobId}`);
          if (response.ok) {
            const jobInfo: JobInfo = await response.json();
            knownJobsRef.current.delete(jobId);
            onJobCompleted(jobInfo);
          }
        }
      }

      // Update known jobs
      knownJobsRef.current = new Set(jobs.map(j => j.id));
    } catch (e) {
      // Silently fail - this is just for notification enhancement
      console.warn('Failed to check for active jobs:', e);
    }
  }, [onJobCompleted]);

  const startChecking = useCallback(() => {
    // Initial check
    checkForCompletedJobs();

    // Then poll periodically
    pollingRef.current = setInterval(checkForCompletedJobs, pollInterval);
  }, [checkForCompletedJobs, pollInterval]);

  const stopChecking = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopChecking();
    };
  }, [stopChecking]);

  return {
    startChecking,
    stopChecking,
  };
}

/**
 * Get jobs from sessionStorage that we should resume polling for.
 * Call this on app mount to resume tracking any jobs started before page refresh.
 */
export function getPersistedJobId(): string | null {
  return sessionStorage.getItem('cvforge_active_job_id');
}

/**
 * Persist a job ID to sessionStorage so we can resume polling after page refresh.
 */
export function persistJobId(jobId: string): void {
  sessionStorage.setItem('cvforge_active_job_id', jobId);
}

/**
 * Clear the persisted job ID.
 */
export function clearPersistedJobId(): void {
  sessionStorage.removeItem('cvforge_active_job_id');
}
