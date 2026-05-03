'use client';

import { useCallback, useRef, useState } from 'react';
import type { ImportResult } from '@/stores/knowledgeStore';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import ImportSummary from './ImportSummary';

type Step = 'pick' | 'preview' | 'importing' | 'done';

export default function ImportWizard() {
  const [step, setStep] = useState<Step>('pick');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { importFiles } = useKnowledgeStore();

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.md'));
    if (dropped.length > 0) {
      setFiles(dropped);
      setStep('preview');
    }
  }, []);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) {
      setFiles(selected);
      setStep('preview');
    }
  }, []);

  const startImport = useCallback(async () => {
    setStep('importing');
    const res = await importFiles(files);
    setResults(res);
    setStep('done');
  }, [files, importFiles]);

  const reset = useCallback(() => {
    setFiles([]);
    setResults([]);
    setStep('pick');
  }, []);

  if (step === 'done') {
    return <ImportSummary results={results} onReset={reset} />;
  }

  return (
    <div className="space-y-4">
      {step === 'pick' && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-cafe-border px-6 py-12 transition-colors hover:border-cafe-accent"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <svg className="h-10 w-10 text-cafe-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-sm text-cafe-secondary">
            Drop <code>.md</code> files here or click to browse
          </p>
          <input ref={fileRef} type="file" accept=".md" multiple className="hidden" onChange={onFileSelect} />
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-3">
          <h3 className="font-medium text-cafe">Files to import ({files.length})</h3>
          <ul className="space-y-1">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center justify-between rounded border border-cafe-border px-3 py-2 text-sm"
              >
                <span className="text-cafe">{f.name}</span>
                <span className="text-cafe-muted">{(f.size / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-cafe-border px-4 py-2 text-sm text-cafe-secondary hover:bg-cafe-surface-elevated"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={startImport}
              className="rounded-md bg-cafe-accent px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Import
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cafe-border/30 border-t-cafe-accent" />
          <p className="text-sm text-cafe-muted">Importing {files.length} file(s)...</p>
        </div>
      )}
    </div>
  );
}
