'use client';

interface Passage {
  passageId: string;
  content: string;
  position: number;
  headingPath: string[] | null;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
}

export default function ChunkViewer({ passage }: { passage: Passage }) {
  return (
    <div className="rounded-lg border p-3 dark:border-gray-700">
      {passage.headingPath && passage.headingPath.length > 0 && (
        <p className="mb-1 text-xs text-gray-400">
          {passage.headingPath.join(' > ')}
        </p>
      )}
      <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
        {passage.content}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        chunk #{passage.chunkIndex} &middot; chars {passage.charStart}–{passage.charEnd}
      </p>
    </div>
  );
}
