'use client';

interface GovernanceRibbonProps {
  status: string;
  onAction: (targetStatus: string) => void;
  loading?: boolean;
}

const RIBBON_CONFIG: Record<
  string,
  {
    bg: string;
    text: string;
    label: string;
    actions: Array<{ status: string; label: string; className: string }>;
  }
> = {
  needs_review: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    label: 'Review Required',
    actions: [
      { status: 'approved', label: 'Approve', className: 'bg-green-700 hover:bg-green-800 text-white' },
      { status: 'rejected', label: 'Reject', className: 'bg-red-700 hover:bg-red-800 text-white' },
    ],
  },
  active: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    label: 'Active Knowledge',
    actions: [{ status: 'retired', label: 'Retire', className: 'bg-gray-600 hover:bg-gray-700 text-white' }],
  },
  rejected: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-600',
    label: 'Rejected',
    actions: [],
  },
  retired: {
    bg: 'bg-gray-50 border-gray-200',
    text: 'text-gray-500',
    label: 'Retired',
    actions: [],
  },
};

export default function GovernanceRibbon({ status, onAction, loading }: GovernanceRibbonProps) {
  const config = RIBBON_CONFIG[status];
  if (!config) return null;

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-2 ${config.bg}`}>
      <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
      {config.actions.length > 0 && (
        <div className="flex gap-2">
          {config.actions.map((a) => (
            <button
              key={a.status}
              type="button"
              disabled={loading}
              onClick={() => onAction(a.status)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${a.className} disabled:opacity-50`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
