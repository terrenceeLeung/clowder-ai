import { describe, expect, it } from 'vitest';
import { buildBackHref, buildMemoryTabItems, resolveReferrerThread } from '../MemoryNav';

describe('buildMemoryTabItems', () => {
  it('includes explore tab', () => {
    const items = buildMemoryTabItems('');
    const explore = items.find((i) => i.id === 'explore');
    expect(explore).toBeDefined();
    expect(explore!.href).toBe('/memory/explore');
    expect(explore!.label).toBe('Explore');
  });

  it('preserves from suffix on explore tab', () => {
    const items = buildMemoryTabItems('?from=abc');
    const explore = items.find((i) => i.id === 'explore');
    expect(explore!.href).toBe('/memory/explore?from=abc');
  });

  it('includes all 5 tabs', () => {
    const items = buildMemoryTabItems('');
    expect(items).toHaveLength(5);
    const ids = items.map((i) => i.id);
    expect(ids).toContain('feed');
    expect(ids).toContain('explore');
    expect(ids).toContain('search');
    expect(ids).toContain('status');
    expect(ids).toContain('health');
  });
});

describe('resolveReferrerThread', () => {
  it('returns from param when present', () => {
    expect(resolveReferrerThread('?from=t1', null)).toBe('t1');
  });

  it('falls back to store thread', () => {
    expect(resolveReferrerThread('', 'thread-abc')).toBe('thread-abc');
  });

  it('returns null for default thread', () => {
    expect(resolveReferrerThread('', 'default')).toBeNull();
  });
});

describe('buildBackHref', () => {
  it('builds thread href', () => {
    expect(buildBackHref('t1')).toBe('/thread/t1');
  });

  it('returns root for null', () => {
    expect(buildBackHref(null)).toBe('/');
  });
});
