'use client';

import { useCallback, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

const DOC_KINDS = ['guide', 'reference', 'tutorial', 'faq', 'runbook'] as const;

interface MetadataEditorProps {
  anchor: string;
  initialKeywords?: string[];
  initialDocKind?: string;
  onSave?: () => void;
}

export default function MetadataEditor({ anchor, initialKeywords = [], initialDocKind, onSave }: MetadataEditorProps) {
  const [keywords, setKeywords] = useState(initialKeywords.join(', '));
  const [docKind, setDocKind] = useState(initialDocKind ?? '');
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    const parsedKeywords = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    await apiFetch(`/api/knowledge/docs/${encodeURIComponent(anchor)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keywords: parsedKeywords, docKind: docKind || undefined }),
    });
    setSaving(false);
    onSave?.();
  }, [anchor, keywords, docKind, onSave]);

  return (
    <div className="space-y-3 rounded-lg border bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800/50">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Keywords</label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="comma-separated keywords"
          className="w-full rounded border px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Doc Kind</label>
        <select
          value={docKind}
          onChange={(e) => setDocKind(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">— unset —</option>
          {DOC_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
