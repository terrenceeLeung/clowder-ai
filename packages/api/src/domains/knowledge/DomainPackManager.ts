// F179: Domain Pack CRUD — lightweight grouping for domain knowledge (KD-1, AC-012)

import type Database from 'better-sqlite3';

export interface DomainPack {
  packId: string;
  name: string;
  description: string | null;
  createdAt: string;
  docCount: number;
}

export class DomainPackManager {
  constructor(private readonly db: Database.Database) {}

  ensureDefaultPack(): string {
    this.db
      .prepare(`
      INSERT OR IGNORE INTO domain_packs (pack_id, name, description, created_at)
      VALUES ('default', 'default', 'Auto-created default domain pack', ?)
    `)
      .run(new Date().toISOString());
    return 'default';
  }

  create(name: string, description?: string): string {
    const packId = name;
    this.db
      .prepare(`
      INSERT INTO domain_packs (pack_id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `)
      .run(packId, name, description ?? null, new Date().toISOString());
    return packId;
  }

  list(): DomainPack[] {
    const rows = this.db
      .prepare(`
      SELECT dp.pack_id, dp.name, dp.description, dp.created_at,
             COUNT(ed.anchor) as doc_count
      FROM domain_packs dp
      LEFT JOIN evidence_docs ed ON ed.pack_id = dp.pack_id
      GROUP BY dp.pack_id
      ORDER BY dp.created_at
    `)
      .all() as Array<{
      pack_id: string;
      name: string;
      description: string | null;
      created_at: string;
      doc_count: number;
    }>;
    return rows.map((r) => ({
      packId: r.pack_id,
      name: r.name,
      description: r.description,
      createdAt: r.created_at,
      docCount: r.doc_count,
    }));
  }

  rename(oldPackId: string, newName: string): void {
    const newPackId = newName;
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE evidence_docs SET pack_id = ? WHERE pack_id = ?').run(newPackId, oldPackId);
      this.db
        .prepare('UPDATE domain_packs SET pack_id = ?, name = ? WHERE pack_id = ?')
        .run(newPackId, newName, oldPackId);
    });
    tx();
  }

  remove(packId: string): void {
    const count = this.db.prepare('SELECT COUNT(*) as c FROM evidence_docs WHERE pack_id = ?').get(packId) as {
      c: number;
    };
    if (count.c > 0) {
      throw new Error(`Cannot remove pack "${packId}": ${count.c} documents still assigned`);
    }
    this.db.prepare('DELETE FROM domain_packs WHERE pack_id = ?').run(packId);
  }
}
