import type { ForgePlugin, PluginContext, HealthStatus, EventHandler, PluginBusAPI } from '@forge/spec';
import { eventsPluginSpec } from './PluginSpec.js';
import { PluginBus } from '@forge/core';
import { Redis } from 'ioredis';

export class EventsPlugin implements ForgePlugin, PluginBusAPI {
  readonly name = '@forge/events-plugin';
  readonly version = '0.2.0';
  readonly description = 'Event bus — in-memory PluginBus or Redis pub/sub for distributed deployments';
  readonly dependencies: string[] = [];
  readonly provides: string[] = ['events'];
  readonly events: string[] = [];
  readonly spec = eventsPluginSpec;

  private adapter: 'memory' | 'redis' = 'memory';
  private bus: PluginBus;
  private redis: Redis | null = null;
  private redisUrl = '';
  private startTime = 0;
  private localHandlers = new Map<string, Set<EventHandler>>();

  constructor() {
    // Implements PluginBusAPI directly
    this.bus = new PluginBus();
  }

  async init(ctx: PluginContext): Promise<void> {
    this.adapter = ctx.config.get<'memory' | 'redis'>('events.adapter', 'memory') ?? 'memory';
    this.redisUrl = ctx.config.get<string>('events.redisUrl', 'redis://localhost:6379') ?? 'redis://localhost:6379';
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    if (this.adapter === 'redis') {
      this.redis = new Redis(this.redisUrl, { lazyConnect: true });
      await this.redis.connect().catch((err: Error) => {
        console.warn(`[events-plugin] Redis connect failed (falling back to memory): ${err.message}`);
        this.adapter = 'memory';
      });
    }
  }

  async stop(): Promise<void> {
    await this.redis?.quit();
    this.redis = null;
  }

  async healthCheck(): Promise<HealthStatus> {
    const checks: Record<string, boolean> = {};
    if (this.adapter === 'redis' && this.redis) {
      try {
        await this.redis.ping();
        checks['redis'] = true;
      } catch {
        checks['redis'] = false;
      }
    }
    const status = this.adapter === 'redis' && checks['redis'] === false ? 'degraded' : 'healthy';
    return {
      status,
      plugin: this.name,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }

  // ---- PluginBusAPI implementation ----

  emit(event: string, payload: unknown): void {
    if (this.adapter === 'redis' && this.redis) {
      this.redis.publish(event, JSON.stringify(payload)).catch(() => {});
    }
    // Always emit locally too (for same-process handlers)
    this.bus.emit(event, payload);
    // Also invoke local handlers directly
    const handlers = this.localHandlers.get(event);
    handlers?.forEach(h => { try { h(payload); } catch {} });
  }

  on(event: string, handler: EventHandler): () => void {
    if (this.adapter === 'redis' && this.redis) {
      this.setupRedisSubscription(event);
    }
    if (!this.localHandlers.has(event)) {
      this.localHandlers.set(event, new Set());
    }
    this.localHandlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  once(event: string, handler: EventHandler): void {
    this.bus.once(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.localHandlers.get(event)?.delete(handler);
    this.bus.off(event, handler);
  }

  private redisSubscribedChannels = new Set<string>();

  private setupRedisSubscription(channel: string): void {
    if (this.redisSubscribedChannels.has(channel) || !this.redis) return;
    this.redisSubscribedChannels.add(channel);

    this.redis.subscribe(channel).then(() => {
      // channel subscribed
    });

    this.redis.on('message', (ch: string, message: string) => {
      if (ch !== channel) return;
      let payload: unknown;
      try { payload = JSON.parse(message); } catch { payload = message; }
      const handlers = this.localHandlers.get(channel);
      handlers?.forEach(h => { try { h(payload); } catch {} });
    });
  }
}

export default function createPlugin(): ForgePlugin {
  return new EventsPlugin();
}
