'use client';

const DOC_KIND_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  guide: { bg: 'bg-[var(--conn-blue-bg)]', text: 'text-[var(--conn-blue-text)]', label: 'Guide' },
  reference: { bg: 'bg-[var(--conn-green-bg)]', text: 'text-[var(--conn-green-text)]', label: 'Reference' },
  tutorial: { bg: 'bg-[var(--conn-purple-bg)]', text: 'text-[var(--conn-purple-text)]', label: 'Tutorial' },
  faq: { bg: 'bg-[var(--conn-amber-bg)]', text: 'text-[var(--conn-amber-text)]', label: 'FAQ' },
  runbook: { bg: 'bg-[var(--conn-red-bg)]', text: 'text-[var(--conn-red-text)]', label: 'Runbook' },
};

export function DocKindBadge({ kind }: { kind?: string | null }) {
  if (!kind) return null;
  const style = DOC_KIND_STYLES[kind];
  if (!style)
    return (
      <span className="rounded-full bg-[var(--conn-gray-bg)] px-2 py-0.5 text-xs text-[var(--conn-gray-text)]">
        {kind}
      </span>
    );
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>{style.label}</span>
  );
}
