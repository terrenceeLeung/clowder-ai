'use client';

const DOC_KIND_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  guide: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', label: 'Guide' },
  reference: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-300',
    label: 'Reference',
  },
  tutorial: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-300',
    label: 'Tutorial',
  },
  faq: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300', label: 'FAQ' },
  runbook: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'Runbook' },
};

export function DocKindBadge({ kind }: { kind?: string | null }) {
  if (!kind) return null;
  const style = DOC_KIND_STYLES[kind];
  if (!style)
    return (
      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        {kind}
      </span>
    );
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>{style.label}</span>;
}
