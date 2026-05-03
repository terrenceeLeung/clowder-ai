'use client';

import { useCallback, useState } from 'react';
import type { DomainPack } from '@/stores/knowledgeStore';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { apiFetch } from '@/utils/api-client';

interface Cluster {
  suggestedName: string;
  chunkCount: number;
}

export default function PacksPanel() {
  const { packs, createPack, fetchPacks } = useKnowledgeStore();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const onCreatePack = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newName.trim()) return;
      setCreating(true);
      await createPack(newName.trim());
      setNewName('');
      setCreating(false);
    },
    [newName, createPack],
  );

  return (
    <div className="space-y-4">
      <form onSubmit={onCreatePack} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New pack name..."
          className="flex-1 rounded-md border border-cafe-border bg-cafe-surface px-3 py-2 text-sm text-cafe"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-md bg-cafe-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          Create
        </button>
      </form>

      {packs.length === 0 && <p className="py-4 text-center text-sm text-cafe-muted">No domain packs yet.</p>}

      <div className="space-y-2">
        {packs.map((pack) => (
          <PackCard key={pack.packId} pack={pack} onSplit={fetchPacks} />
        ))}
      </div>
    </div>
  );
}

function PackCard({ pack, onSplit }: { pack: DomainPack; onSplit: () => void }) {
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/knowledge/packs/${pack.packId}/graduate`, { method: 'POST' });
      const data = (await res.json()) as { clusters: Cluster[] };
      setClusters(data.clusters);
    } catch {
      setClusters(null);
    }
    setLoading(false);
  }, [pack.packId]);

  const confirmSplit = useCallback(async () => {
    if (!clusters) return;
    setConfirming(true);
    const splits = clusters.map((c) => ({ name: c.suggestedName, topics: [c.suggestedName] }));
    await apiFetch(`/api/knowledge/packs/${pack.packId}/graduate/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ splits }),
    });
    setClusters(null);
    setConfirming(false);
    onSplit();
  }, [pack.packId, clusters, onSplit]);

  return (
    <div className="rounded-xl border border-cafe-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-cafe">{pack.name}</p>
          {pack.description && <p className="mt-0.5 text-sm text-cafe-secondary">{pack.description}</p>}
        </div>
        <div className="flex items-center gap-3 text-sm text-cafe-muted">
          <span>{pack.docCount} docs</span>
          <span className="text-xs">{new Date(pack.createdAt).toLocaleDateString()}</span>
          <button
            type="button"
            onClick={analyze}
            disabled={loading}
            className="rounded-md bg-cafe-accent px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Graduate'}
          </button>
        </div>
      </div>
      {clusters && (
        <div className="mt-3 space-y-2 border-t border-cafe-border pt-3">
          <p className="text-xs font-medium text-cafe-secondary">Suggested splits:</p>
          {clusters.map((c) => (
            <div key={c.suggestedName} className="flex items-center justify-between text-sm">
              <span className="text-cafe">{c.suggestedName}</span>
              <span className="text-xs text-cafe-muted">{c.chunkCount} chunks</span>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setClusters(null)}
              className="rounded border border-cafe-border px-3 py-1 text-xs text-cafe-secondary hover:bg-cafe-surface-elevated"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmSplit}
              disabled={confirming}
              className="rounded bg-cafe-accent px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
            >
              {confirming ? 'Splitting...' : 'Confirm Split'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
