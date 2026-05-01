// F179: Regex-based PII detection (Phase 0). Phase 1 wraps Presidio (KD-12).

export interface PiiMatch {
  type: 'phone' | 'id_card' | 'bank_card' | 'email';
  start: number;
  end: number;
  text: string;
}

export interface IPiiDetector {
  scan(text: string): PiiMatch[];
}

const PATTERNS: ReadonlyArray<{ type: PiiMatch['type']; re: RegExp }> = [
  { type: 'phone', re: /1[3-9]\d{9}/g },
  { type: 'id_card', re: /\d{17}[\dXx]/g },
  { type: 'email', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { type: 'bank_card', re: /\b\d{16,19}\b/g },
];

export class PiiDetector implements IPiiDetector {
  scan(text: string): PiiMatch[] {
    const matches: PiiMatch[] = [];
    for (const { type, re } of PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        matches.push({
          type,
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
        });
      }
    }
    matches.sort((a, b) => a.start - b.start);
    return matches;
  }
}
