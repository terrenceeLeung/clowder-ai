'use client';

import { useCallback, useEffect, useState } from 'react';
import { ModuleGraph } from './ModuleGraph';
import { buildExploreApiUrl } from './module-graph-utils';

interface ModuleOverview {
  id: string;
  name: string;
  anchorCount: number;
  evidenceCount: number;
}

export function KnowledgeExplore() {
  const [modules, setModules] = useState<ModuleOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  useEffect(() => {
    fetch(buildExploreApiUrl())
      .then((res) => res.json())
      .then((data: { modules: ModuleOverview[] }) => setModules(data.modules ?? []))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = useCallback((moduleId: string) => {
    setSelectedModule((prev) => (prev === moduleId ? null : moduleId));
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
          <button
            key={mod.id}
            type="button"
            onClick={() => handleSelect(mod.id)}
            className={[
              'rounded-xl border p-4 text-left transition-all hover:shadow-md',
              selectedModule === mod.id
                ? 'border-cocreator-primary bg-cocreator-light shadow-sm'
                : 'border-[#E7DAC7] bg-[#FFFDF8] hover:border-cocreator-light',
            ].join(' ')}
            data-testid={`explore-module-${mod.id}`}
          >
            <h3 className="text-sm font-bold text-[#8B6F47]">{mod.name}</h3>
            <p className="mt-1 text-xs text-[#9A866F]">
              {mod.anchorCount} anchors · {mod.evidenceCount} evidence docs
            </p>
          </button>
        ))}
      </div>

      {selectedModule && <ModuleGraph moduleId={selectedModule} />}
    </div>
  );
}
