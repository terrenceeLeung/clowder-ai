'use client';

import { useCallback, useState } from 'react';
import { useKnowledgeStore } from '@/stores/knowledgeStore';

export default function RetrievalPlayground() {
  const [query, setQuery] = useState('');
  const { searchResults, searchPassages, loading } = useKnowledgeStore();

  const onSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) searchPassages(query.trim());
    },
    [query, searchPassages],
  );

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
          <div key={r.passageId} className="rounded-lg border p-3 dark:border-gray-700">
            {r.headingPath && r.headingPath.length > 0 && (
              <p className="mb-1 text-xs text-gray-400">{r.headingPath.join(' > ')}</p>
            )}
            <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{r.content}</p>
            <p className="mt-1 text-xs text-gray-400">
              doc: {r.docAnchor} &middot; chunk #{r.chunkIndex}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
