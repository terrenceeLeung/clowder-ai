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
    <div className="rounded-lg border border-cafe-border p-3">
      {passage.headingPath && passage.headingPath.length > 0 && (
        <p className="mb-1 text-xs text-cafe-muted">{passage.headingPath.join(' > ')}</p>
      )}
      <p className="whitespace-pre-wrap text-sm text-cafe">{passage.content}</p>
      <p className="mt-1 text-xs text-cafe-muted">
        chunk #{passage.chunkIndex} &middot; chars {passage.charStart}&ndash;{passage.charEnd}
      </p>
    </div>
  );
}
