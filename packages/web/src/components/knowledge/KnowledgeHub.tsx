'use client';

import { useEffect, useState } from 'react';
import type { KnowledgeDoc } from '@/stores/knowledgeStore';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import DocDetail from './DocDetail';
import ImportWizard from './ImportWizard';
import PacksPanel from './PacksPanel';
import RetrievalPlayground from './RetrievalPlayground';

const TABS = [
  { key: 'browse', label: 'Browse' },
  { key: 'import', label: 'Import' },
  { key: 'search', label: 'Search' },
  { key: 'packs', label: 'Packs' },
] as const;

const GOV_BADGE: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-[var(--conn-green-bg)]', text: 'text-[var(--conn-green-text)]' },
  approved: { bg: 'bg-[var(--conn-blue-bg)]', text: 'text-[var(--conn-blue-text)]' },
  needs_review: { bg: 'bg-[var(--conn-amber-bg)]', text: 'text-[var(--conn-amber-text)]' },
  stale: { bg: 'bg-[var(--conn-gray-bg)]', text: 'text-[var(--conn-gray-text)]' },
  retired: { bg: 'bg-[var(--conn-gray-bg)]', text: 'text-[var(--conn-gray-text)]' },
};

function GovBadge({ status }: { status: string }) {
  const style = GOV_BADGE[status] ?? GOV_BADGE.stale;
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function DocRow({ doc, onClick }: { doc: KnowledgeDoc; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-cafe-border/30 bg-cafe-surface px-4 py-3 text-left transition-all hover:bg-cafe-surface-elevated hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-cafe">{doc.title || doc.anchor}</p>
          <GovBadge status={doc.governanceStatus} />
        </div>
        {doc.summary && <p className="mt-0.5 truncate text-xs text-cafe-secondary">{doc.summary}</p>}
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-3">
        <span className="text-[10px] font-medium uppercase tracking-tight text-cafe-muted">
          {new Date(doc.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </button>
  );
}

export default function KnowledgeHub() {
  const { docs, activeTab, loading, setActiveTab, fetchDocs, fetchPacks } = useKnowledgeStore();
  const [selectedAnchor, setSelectedAnchor] = useState<string | null>(null);

  useEffect(() => {
    fetchDocs();
    fetchPacks();
  }, [fetchDocs, fetchPacks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-cafe-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setActiveTab(t.key);
              setSelectedAnchor(null);
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key ? 'bg-cafe-surface-elevated text-cafe shadow-sm' : 'text-cafe-muted hover:text-cafe'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && selectedAnchor && (
        <DocDetail anchor={selectedAnchor} onBack={() => setSelectedAnchor(null)} />
      )}

      {activeTab === 'browse' && !selectedAnchor && (
        <div className="space-y-2">
          {loading && <p className="text-sm text-cafe-muted">Loading...</p>}
          {!loading && docs.length === 0 && (
            <p className="py-8 text-center text-cafe-muted">No documents imported yet.</p>
          )}
          {docs.map((doc) => (
            <DocRow key={doc.anchor} doc={doc} onClick={() => setSelectedAnchor(doc.anchor)} />
          ))}
        </div>
      )}

      {activeTab === 'import' && <ImportWizard />}

      {activeTab === 'search' && <RetrievalPlayground />}

      {activeTab === 'packs' && <PacksPanel />}
    </div>
  );
}
