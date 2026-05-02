'use client';

import { create } from 'zustand';
import { apiFetch } from '@/utils/api-client';

export interface KnowledgeDoc {
  anchor: string;
  title: string;
  summary?: string;
  kind: string;
  status: string;
  governanceStatus: string;
  updatedAt: string;
}

export interface DomainPack {
  packId: string;
  name: string;
  description: string | null;
  createdAt: string;
  docCount: number;
}

export interface PassageResult {
  passageId: string;
  docAnchor: string;
  content: string;
  headingPath: string[] | null;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
  docKind?: string;
}

export interface ImportResult {
  sourcePath: string;
  anchor: string | null;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  chunkCount?: number;
  reason?: string;
}

interface KnowledgeState {
  docs: KnowledgeDoc[];
  packs: DomainPack[];
  searchResults: PassageResult[];
  searchQuery: string;
  activeTab: 'browse' | 'import' | 'search' | 'packs';
  loading: boolean;

  setActiveTab: (tab: KnowledgeState['activeTab']) => void;
  fetchDocs: () => Promise<void>;
  fetchPacks: () => Promise<void>;
  searchPassages: (query: string) => Promise<void>;
  importFiles: (files: File[]) => Promise<ImportResult[]>;
  createPack: (name: string, description?: string) => Promise<void>;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  docs: [],
  packs: [],
  searchResults: [],
  searchQuery: '',
  activeTab: 'browse',
  loading: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchDocs: async () => {
    set({ loading: true });
    const res = await apiFetch('/api/knowledge/docs');
    if (res.ok) {
      const data = await res.json();
      set({ docs: data.docs });
    }
    set({ loading: false });
  },

  fetchPacks: async () => {
    const res = await apiFetch('/api/knowledge/packs');
    if (res.ok) {
      const data = await res.json();
      set({ packs: data.packs });
    }
  },

  searchPassages: async (query) => {
    set({ loading: true, searchQuery: query });
    const res = await apiFetch(`/api/knowledge/search?q=${encodeURIComponent(query)}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      set({ searchResults: data.results });
    }
    set({ loading: false });
  },

  importFiles: async (files) => {
    set({ loading: true });
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    const res = await apiFetch('/api/knowledge/import', {
      method: 'POST',
      body: formData,
    });
    set({ loading: false });
    if (res.ok) {
      const data = await res.json();
      await get().fetchDocs();
      return data.results as ImportResult[];
    }
    return [];
  },

  createPack: async (name, description) => {
    const res = await apiFetch('/api/knowledge/packs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) {
      await get().fetchPacks();
    }
  },
}));
