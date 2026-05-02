'use client';

import { useCallback, useRef, useState } from 'react';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import type { ImportResult } from '@/stores/knowledgeStore';
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
          className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 px-6 py-12 transition-colors hover:border-blue-400 dark:border-gray-600 dark:hover:border-blue-500"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drop <code>.md</code> files here or click to browse
          </p>
          <input ref={fileRef} type="file" accept=".md" multiple className="hidden" onChange={onFileSelect} />
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Files to import ({files.length})</h3>
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.name} className="flex items-center justify-between rounded border px-3 py-2 text-sm dark:border-gray-700">
                <span className="text-gray-800 dark:text-gray-200">{f.name}</span>
                <span className="text-gray-400">{(f.size / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={startImport}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Import
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="text-sm text-gray-500">Importing {files.length} file(s)...</p>
        </div>
      )}
    </div>
  );
}
