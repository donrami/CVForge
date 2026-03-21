import { useState, useEffect, useCallback, useRef } from 'react';

export type JobPhase = 'preparing' | 'ai-working' | 'finalizing' | null;
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | null;

export interface JobInfo {
  id: string;
  status: JobStatus;
  phase: JobPhase;
  aiChars: number;
  applicationId: string | null;
  error: string | null;
  companyName?: string;
  jobTitle?: string;
}

export interface UseJobStatusOptions {
  /** Poll interval in ms (default: 2000) */
  pollInterval?: number;
  /** Callback when job completes successfully */
  onComplete?: (applicationId: string, companyName?: string, jobTitle?: string) => void;
  /** Callback when job fails */
  onError?: (error: string) => void;
  /** Callback for job progress updates */
  onProgress?: (phase: JobPhase, aiChars: number) => void;
}

export interface UseJobStatusReturn {
  /** Current job info */
  job: JobInfo | null;
  /** Loading state */
  loading: boolean;
  /** Error fetching job status */
  error: string | null;
  /** Start polling for a job */
  startPolling: (jobId: string) => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Reset state */
  reset: () => void;
}

/**
 * Hook for polling job status until completion or error.
 * 
 * @example
 * ```tsx
 * const { job, startPolling, stopPolling } = useJobStatus({
 *   onComplete: (appId) => toast('CV ready!'),
 *   onError: (err) => toast(err, 'error'),
 * });
 * 
 * // Start polling
 * startPolling(jobId);
 * 
 * // Clean up on unmount
 * useEffect(() => () => stopPolling(), []);
 * ```
 */
export function useJobStatus(options: UseJobStatusOptions = {}): UseJobStatusReturn {
  const { pollInterval = 2000, onComplete, onError, onProgress } = options;

  const [job, setJob] = useState<JobInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    jobIdRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setJob(null);
    setLoading(false);
    setError(null);
  }, [stopPolling]);

  const fetchJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch job status');
      }
      const data: JobInfo = await response.json();
      
      setJob(data);
      setError(null);

      // Notify progress
      if (data.status === 'PROCESSING' && onProgress) {
        onProgress(data.phase as JobPhase, data.aiChars);
      }

      // Check for terminal states
      if (data.status === 'COMPLETED') {
        stopPolling();
        if (onComplete) {
          onComplete(data.applicationId!, data.companyName, data.jobTitle);
        }
      } else if (data.status === 'FAILED') {
        stopPolling();
        if (onError) {
          onError(data.error || 'Generation failed');
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
      if (onError) {
        onError(message);
      }
    }
  }, [onComplete, onError, onProgress, stopPolling]);

  const startPolling = useCallback((jobId: string) => {
    // Stop any existing polling
    stopPolling();
    
    setLoading(true);
    setError(null);
    jobIdRef.current = jobId;

    // Fetch immediately
    fetchJobStatus(jobId).then(() => {
      setLoading(false);
    });

    // Then poll at interval (only if not already complete/failed)
    pollingRef.current = setInterval(() => {
      if (jobIdRef.current) {
        fetchJobStatus(jobIdRef.current);
      }
    }, pollInterval);
  }, [fetchJobStatus, pollInterval, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    job,
    loading,
    error,
    startPolling,
    stopPolling,
    reset,
  };
}

/**
 * Check if there are any active jobs on mount.
 * Useful for showing notifications for jobs that completed while user was away.
 */
export async function fetchActiveJobs(): Promise<{ id: string; status: string; companyName: string; jobTitle: string }[]> {
  const response = await fetch('/api/jobs');
  if (!response.ok) {
    throw new Error('Failed to fetch active jobs');
  }
  const data = await response.json();
  return data.jobs;
}
