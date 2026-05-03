'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import ChunkViewer from './ChunkViewer';

interface DocMeta {
  anchor: string;
  title: string;
  summary?: string;
  kind: string;
  status: string;
  governanceStatus: string;
  updatedAt: string;
}

interface Passage {
  passageId: string;
  content: string;
  position: number;
  headingPath: string[] | null;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
}

interface DocDetailProps {
  anchor: string;
  onBack: () => void;
}

export default function DocDetail({ anchor, onBack }: DocDetailProps) {
  const [doc, setDoc] = useState<DocMeta | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/api/knowledge/docs/${encodeURIComponent(anchor)}`);
    if (res.ok) {
      const data = await res.json();
      setDoc(data.doc);
      setPassages(data.passages);
    }
    setLoading(false);
  }, [anchor]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-cafe-muted">Loading...</p>;
  if (!doc) return <p className="text-sm text-[var(--conn-red-text)]">Document not found.</p>;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-cafe-accent hover:underline">
        &larr; Back to list
      </button>

      <div className="rounded-xl border border-cafe-border p-4">
        <h2 className="text-lg font-semibold text-cafe">{doc.title}</h2>
        {doc.summary && <p className="mt-1 text-sm text-cafe-secondary">{doc.summary}</p>}
        <div className="mt-2 flex gap-3 text-xs text-cafe-muted">
          <span>
            Governance: <strong>{doc.governanceStatus}</strong>
          </span>
          <span>Kind: {doc.kind}</span>
          <span>Updated: {new Date(doc.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>

      <h3 className="font-medium text-cafe">Chunks ({passages.length})</h3>
      <div className="space-y-2">
        {passages.map((p) => (
          <ChunkViewer key={p.passageId} passage={p} />
        ))}
      </div>
    </div>
  );
}
