'use client';

import type { ImportResult } from '@/stores/knowledgeStore';

interface ImportSummaryProps {
  results: ImportResult[];
  onReset: () => void;
}

export default function ImportSummary({ results, onReset }: ImportSummaryProps) {
  const created = results.filter((r) => r.status === 'created').length;
  const updated = results.filter((r) => r.status === 'updated').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const totalChunks = results.reduce((sum, r) => sum + (r.chunkCount ?? 0), 0);

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900 dark:text-gray-100">Import Complete</h3>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Created" value={created} color="text-green-600" />
        <StatCard label="Updated" value={updated} color="text-blue-600" />
        <StatCard label="Failed" value={failed} color="text-red-600" />
        <StatCard label="Chunks" value={totalChunks} color="text-purple-600" />
      </div>

      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((r) => (
            <li
              key={r.sourcePath}
              className="flex items-center justify-between rounded border px-3 py-2 text-sm dark:border-gray-700"
            >
              <span className="truncate text-gray-800 dark:text-gray-200">
                {r.sourcePath.split('/').pop()}
              </span>
              <div className="flex items-center gap-2">
                {r.chunkCount != null && (
                  <span className="text-xs text-gray-400">{r.chunkCount} chunks</span>
                )}
                <StatusBadge status={r.status} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onReset}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >
        Import More
      </button>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border p-3 text-center dark:border-gray-700">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    created: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    updated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    skipped: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.skipped}`}>
      {status}
    </span>
  );
}
