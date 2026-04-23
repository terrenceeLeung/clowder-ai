import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseKnowledgeMap } from '../../dist/domains/memory/knowledge-map.js';

describe('parseKnowledgeMap', () => {
  it('parses valid YAML into KnowledgeMap', () => {
    const yaml = `
version: 1
modules:
  memory:
    name: 记忆系统
    anchors:
      - docs/features/F102.md
      - docs/features/F163.md
`;
    const result = parseKnowledgeMap(yaml);
    assert.equal(result.version, 1);
    assert.deepEqual(Object.keys(result.modules), ['memory']);
    assert.equal(result.modules.memory.name, '记忆系统');
    assert.deepEqual(result.modules.memory.anchors, ['docs/features/F102.md', 'docs/features/F163.md']);
  });

  it('parses description field', () => {
    const yaml = `
version: 1
modules:
  memory:
    name: 记忆系统
    description: 记忆存储与检索、元数据治理
    anchors:
      - F102
`;
    const result = parseKnowledgeMap(yaml);
    assert.equal(result.modules.memory.description, '记忆存储与检索、元数据治理');
  });

  it('allows missing description', () => {
    const yaml = `
version: 1
modules:
  memory:
    name: 记忆系统
    anchors:
      - F102
`;
    const result = parseKnowledgeMap(yaml);
    assert.equal(result.modules.memory.description, undefined);
  });

  it('parses multiple modules', () => {
    const yaml = `
version: 1
modules:
  memory:
    name: 记忆
    anchors:
      - docs/features/F102.md
  games:
    name: 游戏
    anchors:
      - docs/features/F090.md
      - docs/features/F101.md
`;
    const result = parseKnowledgeMap(yaml);
    assert.equal(Object.keys(result.modules).length, 2);
    assert.equal(result.modules.games.anchors.length, 2);
  });

  it('throws on missing version', () => {
    assert.throws(() => parseKnowledgeMap('modules: {}'), /version/i);
  });

  it('throws on empty modules', () => {
    assert.throws(() => parseKnowledgeMap('version: 1\nmodules: {}'), /module/i);
  });

  it('throws on module without anchors', () => {
    const yaml = 'version: 1\nmodules:\n  m:\n    name: X\n    anchors: []';
    assert.throws(() => parseKnowledgeMap(yaml), /anchor/i);
  });

  it('throws on module without name', () => {
    const yaml = 'version: 1\nmodules:\n  m:\n    anchors:\n      - docs/x.md';
    assert.throws(() => parseKnowledgeMap(yaml), /name/i);
  });
});
