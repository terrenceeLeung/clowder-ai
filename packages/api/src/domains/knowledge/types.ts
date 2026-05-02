// F179: Knowledge domain types

import type { F163Authority } from '../memory/f163-types.js';

export interface NormalizerLLM {
  generate(system: string, user: string): Promise<string>;
}

export interface NormalizedDocument {
  anchor: string;
  title: string;
  summary: string;
  docKind: string;
  authority: F163Authority;
  extractionConfidence: number;
  keywords: string[];
  topics: string[];
  language: string;
  normalizerVersion: string;
  modelId: string;
  chunks: NormalizedChunk[];
}

export interface NormalizedChunk {
  chunkId: string;
  chunkIndex: number;
  headingPath: string[];
  contentMarkdown: string;
  plainText: string;
  charStart: number;
  charEnd: number;
  tokenCount: number;
  dedupeKey: string;
}

export interface NormalizerConfig {
  version: string;
  modelId: string;
}
