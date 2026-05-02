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
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300' },
  approved: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
  needs_review: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300' },
  stale: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500' },
  retired: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500' },
};

function GovBadge({ status }: { status: string }) {
  const style = GOV_BADGE[status] ?? GOV_BADGE.stale;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>{status}</span>
  );
}

function DocRow({ doc, onClick }: { doc: KnowledgeDoc; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900 dark:text-gray-100">{doc.title || doc.anchor}</p>
        {doc.summary && <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{doc.summary}</p>}
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-2">
        <GovBadge status={doc.governanceStatus} />
        <span className="text-xs text-gray-400">{new Date(doc.updatedAt).toLocaleDateString()}</span>
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
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Knowledge Hub</h1>

      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && selectedAnchor && (
        <DocDetail anchor={selectedAnchor} onBack={() => setSelectedAnchor(null)} />
      )}

      {activeTab === 'browse' && !selectedAnchor && (
        <div className="space-y-2">
          {loading && <p className="text-sm text-gray-500">Loading...</p>}
          {!loading && docs.length === 0 && (
            <p className="py-8 text-center text-gray-500">No documents imported yet.</p>
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
