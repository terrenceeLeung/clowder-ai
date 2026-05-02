import type { NormalizerLLM } from './types.js';

export class HeadingNormalizerLLM implements NormalizerLLM {
  async generate(_system: string, user: string): Promise<string> {
    const lines = user.split('\n');
    const title = lines.find((l) => l.startsWith('# '))?.replace(/^#+\s*/, '') ?? 'Untitled';
    const chunks: Array<{
      headingPath: string[];
      contentMarkdown: string;
      plainText: string;
      charStart: number;
      charEnd: number;
      tokenCount: number;
      dedupeKey: string;
    }> = [];

    let currentHeading: string[] = [];
    let chunkStart = 0;
    let chunkContent = '';
    let charOffset = 0;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
      if (headingMatch && chunkContent.trim()) {
        chunks.push(makeChunk(currentHeading, chunkContent, chunkStart, charOffset));
        chunkContent = '';
        chunkStart = charOffset;
      }
      if (headingMatch) {
        const depth = headingMatch[1].length;
        const text = headingMatch[2];
        currentHeading = currentHeading.slice(0, depth - 1);
        currentHeading[depth - 1] = text;
        currentHeading = currentHeading.slice(0, depth);
      }
      chunkContent += line + '\n';
      charOffset += line.length + 1;
    }
    if (chunkContent.trim()) {
      chunks.push(makeChunk(currentHeading, chunkContent, chunkStart, charOffset));
    }

    const keywords = extractKeywords(user);
    return JSON.stringify({
      title,
      summary: lines.slice(0, 3).join(' ').slice(0, 200),
      docKind: 'reference',
      authority: 'candidate',
      extractionConfidence: 0.5,
      keywords,
      topics: [title.split(/\s+/).slice(0, 2).join(' ')],
      language: 'en',
      chunks,
    });
  }
}

function makeChunk(
  headingPath: string[],
  content: string,
  charStart: number,
  charEnd: number,
): {
  headingPath: string[];
  contentMarkdown: string;
  plainText: string;
  charStart: number;
  charEnd: number;
  tokenCount: number;
  dedupeKey: string;
} {
  const plain = content.replace(/[#*_`~[\]]/g, '').trim();
  return {
    headingPath: [...headingPath],
    contentMarkdown: content.trim(),
    plainText: plain,
    charStart,
    charEnd,
    tokenCount: Math.ceil(plain.length / 4),
    dedupeKey: plain.slice(0, 40).replace(/\W+/g, '-').toLowerCase(),
  };
}

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}
