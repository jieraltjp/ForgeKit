import type { ForgePlugin, PluginContext, HealthStatus } from '@forge/spec';
import { configPluginSpec } from './PluginSpec.js';

// Plugin class — exported as named export for factory pattern
export class ConfigPlugin implements ForgePlugin {
  readonly name = '@forge/config-plugin';
  readonly version = '0.1.0';
  readonly description = 'Centralized configuration management for ForgeKit';
  readonly dependencies: string[] = [];
  readonly provides: string[] = ['config'];
  readonly events: string[] = ['config:updated'];
  readonly spec = configPluginSpec;

  private config = new Map<string, unknown>();
  private watchers = new Set<(key: string, value: unknown) => void>();
  private startTime = 0;
  private ctx: PluginContext | null = null;

  constructor(private defaults: Record<string, unknown> = {}) {}

  async init(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
    // Seed defaults
    for (const [k, v] of Object.entries(this.defaults)) {
      this.config.set(k, v);
    }
    // Override from environment (FORGE_KEY=value → config.key = value)
    for (const [k, v] of Object.entries(process.env)) {
      if (k.startsWith('FORGE_')) {
        const key = k.slice(6).toLowerCase().replace(/_/g, '.');
        try {
          this.config.set(key, JSON.parse(v!));
        } catch {
          this.config.set(key, v);
        }
      }
    }
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
  }

  async stop(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      plugin: this.name,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  // ConfigPluginAPI implementation
  get<T = unknown>(key: string, fallback?: T): T | undefined {
    const val = this.config.get(key);
    return (val as T) ?? fallback;
  }

  set(key: string, value: unknown): void {
    this.config.set(key, value);
    for (const w of this.watchers) {
      w(key, value);
    }
    this.ctx?.bus.emit('config:updated', { key, value, plugin: this.name });
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.config);
  }

  onUpdate(callback: (key: string, value: unknown) => void): () => void {
    this.watchers.add(callback);
    return () => this.watchers.delete(callback);
  }
}

export default function createPlugin(_logger: unknown): ForgePlugin {
  return new ConfigPlugin();
}
