'use client';

import { useCallback, useState } from 'react';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import type { DomainPack } from '@/stores/knowledgeStore';

export default function PacksPanel() {
  const { packs, createPack } = useKnowledgeStore();
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
          className="flex-1 rounded-md border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Create
        </button>
      </form>

      {packs.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No domain packs yet.</p>
      )}

      <div className="space-y-2">
        {packs.map((pack) => (
          <PackCard key={pack.packId} pack={pack} />
        ))}
      </div>
    </div>
  );
}

function PackCard({ pack }: { pack: DomainPack }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3 dark:border-gray-700">
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100">{pack.name}</p>
        {pack.description && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{pack.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>{pack.docCount} docs</span>
        <span className="text-xs text-gray-400">{new Date(pack.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
