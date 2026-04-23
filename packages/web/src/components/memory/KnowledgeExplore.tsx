'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../../utils/api-client';
import { ModuleGraph } from './ModuleGraph';
import { buildExploreApiUrl } from './module-graph-utils';

interface ModuleOverview {
  id: string;
  name: string;
  description?: string;
  anchorCount: number;
  evidenceCount: number;
}

export function KnowledgeExplore() {
  const [modules, setModules] = useState<ModuleOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [startingTour, setStartingTour] = useState<string | null>(null);

  useEffect(() => {
    fetch(buildExploreApiUrl())
      .then((res) => {
        if (!res.ok) throw new Error(`Explore API failed: ${res.status}`);
        return res.json();
      })
      .then((data: { modules: ModuleOverview[] }) => setModules(data.modules ?? []))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = useCallback((moduleId: string) => {
    setSelectedModule((prev) => (prev === moduleId ? null : moduleId));
  }, []);

  const handleStartTour = useCallback(async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStartingTour(moduleId);
    try {
      const res = await fetch(`${API_URL}/api/feynman/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleId }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as { thread: { id: string }; reused: boolean };
      window.location.href = `/thread/${data.thread.id}`;
    } catch (err: unknown) {
      setError(`导览启动失败: ${String(err)}`);
    } finally {
      setStartingTour(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#9A866F]" data-testid="explore-loading">
        加载模块概览...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="explore-error">
        {error}
      </div>
    );
  }

  return (
    <div data-testid="knowledge-explore">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((mod) => (
          <div
            key={mod.id}
            role="button"
            tabIndex={0}
            onClick={() => handleSelect(mod.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelect(mod.id);
              }
            }}
            className={[
              'cursor-pointer rounded-xl border p-4 text-left transition-all hover:shadow-md',
              selectedModule === mod.id
                ? 'border-cocreator-primary bg-cocreator-light shadow-sm'
                : 'border-[#E7DAC7] bg-[#FFFDF8] hover:border-cocreator-light',
            ].join(' ')}
            data-testid={`explore-module-${mod.id}`}
          >
            <h3 className="text-sm font-bold text-[#8B6F47]">{mod.name}</h3>
            {mod.description && <p className="mt-0.5 text-[10px] leading-tight text-[#B5A18C]">{mod.description}</p>}
            <p className="mt-1 text-xs text-[#9A866F]">
              {mod.anchorCount} anchors · {mod.evidenceCount} evidence docs
            </p>
            <button
              type="button"
              disabled={startingTour === mod.id}
              onClick={(e) => handleStartTour(mod.id, e)}
              className="mt-2 rounded-lg bg-cocreator-primary px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-cocreator-primary/90 disabled:opacity-50"
              data-testid={`explore-tour-${mod.id}`}
            >
              {startingTour === mod.id ? '启动中...' : '开始导览'}
            </button>
          </div>
        ))}
      </div>

      {selectedModule && <ModuleGraph moduleId={selectedModule} />}
    </div>
  );
}
