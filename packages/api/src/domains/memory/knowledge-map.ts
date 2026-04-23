import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

export interface KnowledgeModule {
  name: string;
  description?: string;
  anchors: string[];
}

export interface KnowledgeMap {
  version: 1;
  modules: Record<string, KnowledgeModule>;
}

export function parseKnowledgeMap(raw: string): KnowledgeMap {
  const doc = parse(raw) as Record<string, unknown>;
  if (!doc || doc.version !== 1) throw new Error('knowledge-map: version must be 1');
  const modules = doc.modules as Record<string, unknown> | undefined;
  if (!modules || typeof modules !== 'object' || Object.keys(modules).length === 0) {
    throw new Error('knowledge-map: must have at least one module');
  }
  const parsed: Record<string, KnowledgeModule> = {};
  for (const [id, val] of Object.entries(modules)) {
    const m = val as { name?: string; description?: string; anchors?: string[] };
    if (!m.name) throw new Error(`knowledge-map: module "${id}" missing name`);
    if (!Array.isArray(m.anchors) || m.anchors.length === 0) {
      throw new Error(`knowledge-map: module "${id}" must have at least one anchor`);
    }
    parsed[id] = { name: m.name, anchors: m.anchors };
    if (m.description) parsed[id].description = m.description;
  }
  return { version: 1, modules: parsed };
}

export function loadKnowledgeMap(projectRoot: string): KnowledgeMap {
  const filePath = resolve(projectRoot, 'docs/knowledge-map.yaml');
  const raw = readFileSync(filePath, 'utf-8');
  return parseKnowledgeMap(raw);
}
