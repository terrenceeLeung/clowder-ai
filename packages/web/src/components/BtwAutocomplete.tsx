'use client';

import type { BacklogItem } from '@cat-cafe/shared';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

export interface BtwAutocompleteHandle {
  filteredCount: number;
  selectByIndex: (idx: number) => void;
}

interface BtwAutocompleteProps {
  filter: string;
  onSelect: (featureId: string, title: string) => void;
  selectedIdx: number;
}

let cachedItems: Array<{ id: string; title: string }> | null = null;

async function fetchFeatureItems(): Promise<Array<{ id: string; title: string }>> {
  if (cachedItems) return cachedItems;
  try {
    const res = await apiFetch('/api/backlog/items');
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: BacklogItem[] };
    const items = (data.items ?? [])
      .filter((item) => item.tags.some((t) => /^F\d{2,4}$/i.test(t)))
      .map((item) => {
        const fTag = item.tags.find((t) => /^F\d{2,4}$/i.test(t)) ?? '';
        return { id: fTag.toUpperCase(), title: item.title };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    cachedItems = items;
    return items;
  } catch {
    return [];
  }
}

export const BtwAutocomplete = forwardRef<BtwAutocompleteHandle, BtwAutocompleteProps>(function BtwAutocomplete(
  { filter, onSelect, selectedIdx },
  ref,
) {
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFeatureItems().then(setItems);
  }, []);

  const filtered = items.filter(
    (item) =>
      item.id.toLowerCase().includes(filter.toLowerCase()) || item.title.toLowerCase().includes(filter.toLowerCase()),
  );

  const visible = filtered.slice(0, 8);

  useImperativeHandle(
    ref,
    () => ({
      filteredCount: visible.length,
      selectByIndex: (idx: number) => {
        const item = visible[idx];
        if (item) onSelect(item.id, item.title);
      },
    }),
    [visible, onSelect],
  );

  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
      <div className="mx-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-cafe-surface shadow-lg overflow-hidden">
        <div className="px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border-b border-purple-100 dark:border-purple-900">
          Matching Features
        </div>
        <div ref={listRef} className="max-h-40 overflow-y-auto">
          {visible.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id, item.title)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                i === selectedIdx
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200'
                  : 'hover:bg-purple-50 dark:hover:bg-purple-950/30 text-cafe-primary'
              }`}
            >
              <span className="font-mono font-medium text-purple-600 dark:text-purple-400">{item.id}:</span>
              <span className="truncate">{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export function extractBtwFeatureFilter(input: string): string | null {
  const match = input.match(/^\/btw\s+(F\w*)$/i);
  return match ? match[1] : null;
}
