'use client';

import { useCallback, useState } from 'react';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import type { PassageResult } from '@/stores/knowledgeStore';
import { DocKindBadge } from './doc-kind-texture';
import MetadataEditor from './MetadataEditor';

export default function RetrievalPlayground() {
  const [query, setQuery] = useState('');
  const { searchResults, searchPassages, loading } = useKnowledgeStore();
  const [editingAnchor, setEditingAnchor] = useState<string | null>(null);

  const onSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) searchPassages(query.trim());
    },
    [query, searchPassages],
  );

  const reSearch = useCallback(() => {
    setEditingAnchor(null);
    if (query.trim()) searchPassages(query.trim());
  }, [query, searchPassages]);

  return (
    <div className="space-y-4">
      <form onSubmit={onSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search knowledge chunks..."
          className="flex-1 rounded-md border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {loading && <p className="text-sm text-gray-500">Searching...</p>}

      {!loading && searchResults.length === 0 && query && (
        <p className="py-4 text-center text-sm text-gray-500">No results found.</p>
      )}

      <div className="space-y-2">
        {searchResults.map((r) => (
          <SearchResultCard
            key={r.passageId}
            result={r}
            isEditing={editingAnchor === r.docAnchor}
            onEdit={() => setEditingAnchor(r.docAnchor)}
            onSave={reSearch}
          />
        ))}
      </div>
    </div>
  );
}

function SearchResultCard({
  result: r,
  isEditing,
  onEdit,
  onSave,
}: {
  result: PassageResult;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-lg border p-3 dark:border-gray-700">
      {r.headingPath && r.headingPath.length > 0 && (
        <p className="mb-1 text-xs text-gray-400">{r.headingPath.join(' > ')}</p>
      )}
      <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{r.content}</p>
      <div className="mt-2 flex items-center gap-2">
        <DocKindBadge kind={r.docKind} />
        <span className="text-xs text-gray-400">
          doc: {r.docAnchor} &middot; chunk #{r.chunkIndex}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          Edit
        </button>
      </div>
      {isEditing && (
        <div className="mt-2">
          <MetadataEditor anchor={r.docAnchor} onSave={onSave} />
        </div>
      )}
    </div>
  );
}
