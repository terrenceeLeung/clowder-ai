/**
 * F113 Phase E: Hook to fetch governance status for a project path.
 * Used by ChatContainer to decide whether to show ProjectSetupCard.
 */
import { useCallback, useEffect, useState } from 'react';
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

  const fetch_ = useCallback(async () => {
    if (!projectPath || projectPath === 'default' || projectPath === 'lobby') {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/governance/status?projectPath=${encodeURIComponent(projectPath)}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { status, loading, refetch: fetch_ };
}
