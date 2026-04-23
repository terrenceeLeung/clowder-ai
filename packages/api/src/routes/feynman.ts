import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  DEFAULT_THREAD_ID,
  type FeynmanStateV1,
  type IThreadStore,
} from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { KnowledgeMap } from '../domains/memory/knowledge-map.js';
import { resolveUserId } from '../utils/request-identity.js';

export interface FeynmanRoutesOptions {
  threadStore: IThreadStore;
  knowledgeMap: KnowledgeMap;
}

const MODULE_ID_RE = /^[a-z0-9_-]+$/i;

const startSchema = z.object({
  module: z.string().min(1).max(100).regex(MODULE_ID_RE),
});

export const feynmanRoutes: FastifyPluginAsync<FeynmanRoutesOptions> = async (app, opts) => {
  const { threadStore, knowledgeMap } = opts;

  app.post('/api/feynman/start', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const parsed = startSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }
    const { module: moduleId } = parsed.data;

    if (!Object.hasOwn(knowledgeMap.modules, moduleId)) {
      reply.status(404);
      return { error: `Module "${moduleId}" not found in knowledge-map` };
    }
    const mod = knowledgeMap.modules[moduleId];
    if (!mod || !Array.isArray(mod.anchors) || !mod.anchors.every((a: unknown) => typeof a === 'string')) {
      reply.status(500);
      return { error: 'Module has invalid structure' };
    }

    // AC-A2-5: module uniqueness — return existing active feynman thread
    const threads = await threadStore.list(userId);
    const existing = threads.find(
      (t) => t.feynmanState?.module === moduleId && t.feynmanState.status === 'active' && t.id !== DEFAULT_THREAD_ID,
    );
    if (existing) {
      return { thread: { id: existing.id, title: existing.title, feynmanState: existing.feynmanState }, reused: true };
    }

    const title = `费曼导览：${mod.name}`;
    const thread = await threadStore.create(userId, title);
    const feynmanState: FeynmanStateV1 = {
      v: 1,
      module: moduleId,
      anchors: mod.anchors,
      status: 'active',
      startedAt: Date.now(),
    };
    await threadStore.updateFeynmanState(thread.id, feynmanState);
    const updated = (await threadStore.get(thread.id)) ?? thread;

    reply.status(201);
    return { thread: { id: updated.id, title: updated.title, feynmanState: updated.feynmanState }, reused: false };
  });

  app.get('/api/feynman/threads', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }
    const allThreads = await threadStore.list(userId);
    const feynmanThreads = allThreads
      .filter((t) => t.feynmanState && t.id !== DEFAULT_THREAD_ID)
      .sort((a, b) => (b.feynmanState?.startedAt ?? 0) - (a.feynmanState?.startedAt ?? 0));
    return {
      threads: feynmanThreads.map((t) => ({
        id: t.id,
        title: t.title,
        module: t.feynmanState!.module,
        status: t.feynmanState!.status,
        startedAt: t.feynmanState!.startedAt,
      })),
    };
  });
};
