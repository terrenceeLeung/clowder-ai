import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify from 'fastify';
import { evidenceRoutes } from '../../dist/routes/evidence.js';

describe('queryAlwaysOn this-binding (AC-204)', () => {
  const originalEnv = process.env.F163_ALWAYS_ON_INJECTION;
  let app;

  afterEach(async () => {
    if (originalEnv === undefined) delete process.env.F163_ALWAYS_ON_INJECTION;
    else process.env.F163_ALWAYS_ON_INJECTION = originalEnv;
    if (app) await app.close();
  });

  it('search does not degrade when F163 alwaysOnInjection=on', async () => {
    process.env.F163_ALWAYS_ON_INJECTION = 'on';

    let queryAlwaysOnCalled = false;
    const mockStore = {
      _open: true,
      search: async () => [],
      health: async () => true,
      initialize: async () => {},
      upsert: async () => {},
      deleteByAnchor: async () => {},
      getByAnchor: async () => null,
      ensureOpen() {
        if (!this._open) throw new Error('store not initialized');
      },
      queryAlwaysOn() {
        this.ensureOpen();
        queryAlwaysOnCalled = true;
        return [{ anchor: 'always-on-doc' }];
      },
    };

    app = Fastify();
    await app.register(evidenceRoutes, { evidenceStore: mockStore });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=test',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.degraded, false, 'should NOT be degraded');
    assert.ok(queryAlwaysOnCalled, 'queryAlwaysOn should have been called');
    assert.deepEqual(body.injectionSources, ['always-on-doc']);
  });

  it('search works when evidenceStore has no queryAlwaysOn method', async () => {
    process.env.F163_ALWAYS_ON_INJECTION = 'on';

    const mockStore = {
      search: async () => [],
      health: async () => true,
      initialize: async () => {},
      upsert: async () => {},
      deleteByAnchor: async () => {},
      getByAnchor: async () => null,
    };

    app = Fastify();
    await app.register(evidenceRoutes, { evidenceStore: mockStore });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=test',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.degraded, false);
  });
});
