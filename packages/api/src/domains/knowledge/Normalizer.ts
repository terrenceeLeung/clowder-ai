// F179: LLM-driven content normalizer — 3-layer output (KD-5, AC-02)

import { randomUUID } from 'node:crypto';
import type { NormalizedChunk, NormalizedDocument, NormalizerConfig, NormalizerLLM } from './types.js';

const SYSTEM_PROMPT = `You are a document normalizer. Given a markdown document, extract structured metadata and split it into semantic chunks.

Return a JSON object with exactly these fields:
- title: string — document title
- summary: string — 1-2 sentence summary of the entire document
- docKind: string — one of: architecture, operations, faq, troubleshooting, policy, spec, guide, reference, meeting_notes, other
- authority: string — one of: constitutional, validated, candidate, observed
  - constitutional: foundational rules/policies that rarely change
  - validated: reviewed and confirmed information
  - candidate: reasonable content pending review
  - observed: raw notes or unverified content
- extractionConfidence: number 0-1 — how confident you are in the extraction quality
- keywords: string[] — 3-10 key terms for search
- topics: string[] — 1-5 topic categories
- language: string — ISO 639-1 code (en, zh, etc.)
- chunks: array of objects, each with:
  - headingPath: string[] — heading hierarchy from root (e.g. ["Architecture", "Components"])
  - contentMarkdown: string — the chunk content in markdown
  - plainText: string — the chunk content as plain text
  - charStart: number — start character offset in original document
  - charEnd: number — end character offset in original document
  - tokenCount: number — estimated token count
  - dedupeKey: string — short slug for deduplication

Split at heading boundaries (##, ###). Each chunk should be a coherent unit.
Return ONLY valid JSON, no markdown fences or explanation.`;

interface LlmChunk {
  headingPath: string[];
  contentMarkdown: string;
  plainText: string;
  charStart: number;
  charEnd: number;
  tokenCount: number;
  dedupeKey: string;
}

interface LlmResponse {
  title: string;
  summary: string;
  docKind: string;
  authority: string;
  extractionConfidence: number;
  keywords: string[];
  topics: string[];
  language: string;
  chunks: LlmChunk[];
}

const VALID_AUTHORITIES = new Set(['constitutional', 'validated', 'candidate', 'observed']);

export class Normalizer {
  constructor(
    private readonly llm: NormalizerLLM,
    private readonly config: NormalizerConfig,
  ) {}

  async normalize(markdown: string, meta: { sourcePath: string; sourceHash: string }): Promise<NormalizedDocument> {
    if (!markdown || markdown.trim().length === 0) {
      throw new Error('Cannot normalize empty document');
    }

    let raw: string;
    try {
      raw = await this.llm.generate(SYSTEM_PROMPT, markdown);
    } catch (err) {
      throw new Error(`Normalizer failed: ${(err as Error).message}`);
    }

    const parsed = this.parseResponse(raw);
    const anchor = `dk:${randomUUID()}`;

    const chunks: NormalizedChunk[] = parsed.chunks.map((c, i) => ({
      chunkId: `${anchor}:c${i}`,
      chunkIndex: i,
      headingPath: c.headingPath,
      contentMarkdown: c.contentMarkdown,
      plainText: c.plainText,
      charStart: c.charStart,
      charEnd: c.charEnd,
      tokenCount: c.tokenCount,
      dedupeKey: c.dedupeKey,
    }));

    return {
      anchor,
      title: parsed.title,
      summary: parsed.summary,
      docKind: parsed.docKind,
      authority: VALID_AUTHORITIES.has(parsed.authority)
        ? (parsed.authority as NormalizedDocument['authority'])
        : 'observed',
      extractionConfidence: Math.max(0, Math.min(1, parsed.extractionConfidence)),
      keywords: parsed.keywords,
      topics: parsed.topics,
      language: parsed.language || 'en',
      normalizerVersion: this.config.version,
      modelId: this.config.modelId,
      chunks,
    };
  }

  private parseResponse(raw: string): LlmResponse {
    const cleaned = raw
      .replace(/^```json?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();
    try {
      return JSON.parse(cleaned) as LlmResponse;
    } catch {
      throw new Error(`Normalizer failed: invalid JSON response`);
    }
  }
}
