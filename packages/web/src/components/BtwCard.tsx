'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownContent } from '@/components/MarkdownContent';
import type { BtwData } from '@/stores/chat-types';

interface BtwCardProps {
  data: BtwData;
  onDismiss?: () => void;
}

const BTW_HISTORY_KEY = 'cat-cafe-btw-history';
const MAX_HISTORY = 20;

function saveBtwToHistory(data: BtwData): void {
  try {
    const raw = sessionStorage.getItem(BTW_HISTORY_KEY);
    const history: Array<BtwData & { savedAt: number }> = raw ? JSON.parse(raw) : [];
    if (history.some((h) => h.question === data.question && h.answer === data.answer)) return;
    history.unshift({ ...data, savedAt: Date.now() });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    sessionStorage.setItem(BTW_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // sessionStorage unavailable
  }
}

export function getBtwHistory(): Array<BtwData & { savedAt: number }> {
  try {
    const raw = sessionStorage.getItem(BTW_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function BtwCard({ data, onDismiss }: BtwCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Array<BtwData & { savedAt: number }>>([]);
  const savedRef = useRef(false);

  const catName = data.catDisplayName ?? data.catId ?? '猫猫';
  const durationLabel = data.durationMs ? `${(data.durationMs / 1000).toFixed(1)}s` : null;
  const toolsLabel = data.toolsUsed?.length ? `使用了 ${data.toolsUsed.join(', ')}` : null;

  useEffect(() => {
    if (data.answer && !savedRef.current) {
      savedRef.current = true;
      saveBtwToHistory(data);
    }
  }, [data]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  if (showHistory) {
    return (
      <div className="ml-auto max-w-[75%] border border-dashed border-purple-300 dark:border-purple-700 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">BTW 历史记录</span>
          <button
            type="button"
            onClick={() => setShowHistory(false)}
            className="text-xs text-purple-400 hover:text-purple-600 dark:hover:text-purple-300"
          >
            返回
          </button>
        </div>
        {history.length === 0 ? (
          <div className="text-xs text-cafe-muted py-2">暂无历史记录</div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {history.map((item) => (
              <div key={item.savedAt} className="text-xs border-l-2 border-purple-200 dark:border-purple-700 pl-2">
                <div className="font-medium text-purple-700 dark:text-purple-300 truncate">Q: {item.question}</div>
                <div className="text-cafe-muted truncate">{item.answer.slice(0, 80)}...</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ml-auto max-w-[75%] border border-dashed border-purple-300 dark:border-purple-700 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-100/60 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-800">
        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">🔖 旁路问答 · {catName}解答</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setHistory(getBtwHistory());
              setShowHistory(true);
            }}
            className="text-xs text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
          >
            History
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors text-sm leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Question */}
      <div className="mx-3 mt-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 rounded text-sm text-purple-800 dark:text-purple-200">
        Q: {data.question}
      </div>

      {/* Answer (Markdown) */}
      <div className="px-3 py-2 text-sm text-cafe-primary dark:text-gray-200 [&_.markdown-content]:text-sm [&_pre]:bg-cafe-surface-elevated [&_pre]:rounded [&_pre]:p-2 [&_pre]:text-xs [&_code]:font-mono">
        <MarkdownContent content={data.answer} disableCommandPrefix />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-cafe-muted border-t border-purple-100 dark:border-purple-900">
        <span>{[durationLabel, toolsLabel].filter(Boolean).join(' · ') || '旁路回答'}</span>
        <span className="text-purple-400">刷新后消失</span>
      </div>
    </div>
  );
}
