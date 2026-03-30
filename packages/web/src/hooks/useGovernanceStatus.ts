/**
 * F113 Phase E: Hook to fetch governance status for a project path.
 * Used by ChatContainer to decide whether to show ProjectSetupCard.
 *
 * Uses a ref for projectPath so `refetch` always reads the latest value,
 * solving the first-create timing issue where storeThreads → projectPath
 * hasn't propagated yet when ChatContainer first mounts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api-client';

export interface GovernanceStatus {
  ready: boolean;
  needsBootstrap: boolean;
  needsConfirmation: boolean;
  isEmptyDir: boolean;
  isGitRepo: boolean;
  gitAvailable: boolean;
}

interface UseGovernanceStatusResult {
  status: GovernanceStatus | null;
  loading: boolean;
  refetch: () => void;
}

export function useGovernanceStatus(projectPath: string | undefined): UseGovernanceStatusResult {
  const [status, setStatus] = useState<GovernanceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const projectPathRef = useRef(projectPath);
  projectPathRef.current = projectPath;

  const refetch = useCallback(async () => {
    const pp = projectPathRef.current;
    if (!pp || pp === 'default' || pp === 'lobby') {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/governance/status?projectPath=${encodeURIComponent(pp)}`);
      if (res.ok) {
        setStatus(await res.json());
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []); // stable — reads projectPath from ref

  // Auto-fetch when projectPath changes
  useEffect(() => {
    refetch();
  }, [projectPath, refetch]);

  return { status, loading, refetch };
}
