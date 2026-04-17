/**
 * XiaoYi PushId Manager — extract, persist, broadcast push identifiers.
 *
 * pushId is collected from inbound `data.variables.systemVariables.push_id`
 * and persisted to Redis (Set type, deduped). Supports multi-device broadcast.
 *
 * F151 Phase D
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import type { FastifyBaseLogger } from 'fastify';

const REDIS_KEY_PREFIX = 'xiaoyi:pushIds:';

export class XiaoyiPushIdManager {
  private readonly log: FastifyBaseLogger;
  private readonly redis: RedisClient | undefined;
  private readonly agentId: string;
  /** In-memory fallback when Redis is unavailable */
  private readonly memorySet = new Set<string>();

  constructor(log: FastifyBaseLogger, agentId: string, redis?: RedisClient) {
    this.log = log;
    this.agentId = agentId;
    this.redis = redis;
  }

  private redisKey(): string {
    return `${REDIS_KEY_PREFIX}${this.agentId}`;
  }

  async addPushId(pushId: string): Promise<void> {
    if (!pushId) return;
    if (this.redis) {
      try {
        await this.redis.sadd(this.redisKey(), pushId);
      } catch (err) {
        this.log.warn({ err }, '[XiaoYi:PushId] Redis sadd failed, memory-only');
      }
    }
    this.memorySet.add(pushId);
    this.log.debug({ pushId: pushId.slice(0, 20) }, '[XiaoYi:PushId] added');
  }

  async getAllPushIds(): Promise<string[]> {
    if (this.redis) {
      try {
        const ids = await this.redis.smembers(this.redisKey());
        if (ids.length > 0) return ids;
      } catch (err) {
        this.log.warn({ err }, '[XiaoYi:PushId] Redis smembers failed, using memory fallback');
      }
    }
    return [...this.memorySet];
  }

  async getPushIdCount(): Promise<number> {
    if (this.redis) {
      try {
        return await this.redis.scard(this.redisKey());
      } catch (err) {
        this.log.warn({ err }, '[XiaoYi:PushId] Redis scard failed, using memory fallback');
      }
    }
    return this.memorySet.size;
  }

  /**
   * Extract pushId from inbound A2A message params.
   * Path: params.message.parts[kind="data"].data.variables.systemVariables.push_id
   * Also checks top-level params.data for flattened structure.
   */
  extractPushId(params: Record<string, unknown>): string | undefined {
    try {
      const msg = params.message as Record<string, unknown> | undefined;
      const parts = msg?.parts as Array<Record<string, unknown>> | undefined;
      if (parts) {
        for (const part of parts) {
          if (part.kind === 'data') {
            const data = part.data as Record<string, unknown>;
            const vars = data?.variables as Record<string, unknown>;
            const sysVars = vars?.systemVariables as Record<string, unknown>;
            if (typeof sysVars?.push_id === 'string' && sysVars.push_id) {
              return sysVars.push_id;
            }
          }
        }
      }
      // Fallback: check params.data directly (some HAG versions flatten)
      const topData = params.data as Record<string, unknown> | undefined;
      const topVars = topData?.variables as Record<string, unknown>;
      const topSys = topVars?.systemVariables as Record<string, unknown>;
      if (typeof topSys?.push_id === 'string' && topSys.push_id) {
        return topSys.push_id;
      }
    } catch {
      this.log.warn('[XiaoYi:PushId] Failed to extract pushId from inbound');
    }
    return undefined;
  }
}
