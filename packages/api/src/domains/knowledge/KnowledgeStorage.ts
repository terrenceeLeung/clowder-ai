// F179: Private knowledge file storage — .clowder/knowledge/ (gitignored, KD-3/KD-19)

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';

interface RawMeta {
  originalName: string;
  importedAt: string;
}

export class KnowledgeStorage {
  private readonly knowledgeDir: string;

  constructor(private readonly projectRoot: string) {
    this.knowledgeDir = join(projectRoot, '.clowder', 'knowledge');
  }

  async ensureDir(): Promise<string> {
    await mkdir(this.knowledgeDir, { recursive: true });
    return this.knowledgeDir;
  }

  async ensureGitignore(): Promise<void> {
    const gitignorePath = join(this.projectRoot, '.gitignore');
    const entry = '.clowder/knowledge/';
    let content = '';
    try {
      content = await readFile(gitignorePath, 'utf-8');
    } catch {
      // .gitignore doesn't exist yet
    }
    if (content.includes(entry)) return;
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    await writeFile(gitignorePath, `${content}${separator}${entry}\n`);
  }

  async saveRaw(content: string, originalName: string): Promise<string> {
    await this.ensureDir();
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
    const dir = join(this.knowledgeDir, hash);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'original.md'), content, 'utf-8');
    const meta: RawMeta = { originalName, importedAt: new Date().toISOString() };
    await writeFile(join(dir, 'meta.json'), JSON.stringify(meta), 'utf-8');
    return hash;
  }

  async readRaw(hash: string): Promise<string | null> {
    try {
      return await readFile(join(this.knowledgeDir, hash, 'original.md'), 'utf-8');
    } catch {
      return null;
    }
  }

  async getMeta(hash: string): Promise<RawMeta> {
    const raw = await readFile(join(this.knowledgeDir, hash, 'meta.json'), 'utf-8');
    return JSON.parse(raw) as RawMeta;
  }

  async deleteRaw(hash: string): Promise<void> {
    try {
      await rm(join(this.knowledgeDir, hash), { recursive: true, force: true });
    } catch {
      // Already gone
    }
  }

  async exists(hash: string): Promise<boolean> {
    try {
      await access(join(this.knowledgeDir, hash, 'original.md'));
      return true;
    } catch {
      return false;
    }
  }
}
