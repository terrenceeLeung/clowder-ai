'use client';

import type { ImportResult } from '@/stores/knowledgeStore';

interface ImportSummaryProps {
  results: ImportResult[];
  onReset: () => void;
}

const CONFIDENCE_THRESHOLD = 0.7;

export default function ImportSummary({ results, onReset }: ImportSummaryProps) {
  const created = results.filter((r) => r.status === 'created').length;
  const updated = results.filter((r) => r.status === 'updated').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const totalChunks = results.reduce((sum, r) => sum + (r.chunkCount ?? 0), 0);
  const ingested = results.filter((r) => r.status === 'created' || r.status === 'updated');
  const needsReview = ingested.filter((r) => (r.confidence ?? 0) < CONFIDENCE_THRESHOLD).length;
  const autoApproved = ingested.filter((r) => (r.confidence ?? 0) >= CONFIDENCE_THRESHOLD).length;

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-cafe">Import Complete</h3>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <StatCard label="Created" value={created} color="text-[var(--conn-green-text)]" />
        <StatCard label="Updated" value={updated} color="text-[var(--conn-blue-text)]" />
        <StatCard label="Failed" value={failed} color="text-[var(--conn-red-text)]" />
        <StatCard label="Chunks" value={totalChunks} color="text-[var(--conn-purple-text)]" />
        <StatCard label="Needs Review" value={needsReview} color="text-[var(--conn-amber-text)]" />
        <StatCard label="Auto-Approved" value={autoApproved} color="text-[var(--conn-green-text)]" />
      </div>

      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((r) => (
            <li
              key={r.sourcePath}
              className="flex items-center justify-between rounded border border-cafe-border px-3 py-2 text-sm"
            >
              <span className="truncate text-cafe">{r.sourcePath.split('/').pop()}</span>
              <div className="flex items-center gap-2">
                {r.confidence != null && <ConfidenceBadge confidence={r.confidence} />}
                {r.chunkCount != null && <span className="text-xs text-cafe-muted">{r.chunkCount} chunks</span>}
                <StatusBadge status={r.status} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onReset}
        className="rounded-md bg-cafe-accent px-4 py-2 text-sm text-white hover:opacity-90"
      >
        Import More
      </button>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-cafe-border p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-cafe-muted">{label}</p>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const style =
    confidence >= CONFIDENCE_THRESHOLD
      ? 'bg-[var(--conn-green-bg)] text-[var(--conn-green-text)]'
      : 'bg-[var(--conn-amber-bg)] text-[var(--conn-amber-text)]';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${style}`}>{pct}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    created: 'bg-[var(--conn-green-bg)] text-[var(--conn-green-text)]',
    updated: 'bg-[var(--conn-blue-bg)] text-[var(--conn-blue-text)]',
    failed: 'bg-[var(--conn-red-bg)] text-[var(--conn-red-text)]',
    skipped: 'bg-[var(--conn-gray-bg)] text-[var(--conn-gray-text)]',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.skipped}`}>{status}</span>
  );
}
