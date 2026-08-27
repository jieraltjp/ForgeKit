import type { ForgePlugin, PluginContext, HealthStatus, LoggerPluginAPI } from '@forge/spec';
import { loggerPluginSpec } from './PluginSpec.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFormat = 'json' | 'text';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class LoggerPlugin implements ForgePlugin {
  readonly name = '@forge/logger-plugin';
  readonly version = '0.1.0';
  readonly description = 'Structured logging with plugin tagging';
  readonly dependencies: string[] = [];
  readonly provides: string[] = ['logger'];
  readonly events: string[] = [];
  readonly spec = loggerPluginSpec;

  minLevel: LogLevel = 'info';
  format: LogFormat = 'json';
  tags: Record<string, unknown> = {};
  private startTime = 0;

  async init(ctx: PluginContext): Promise<void> {
    this.minLevel = (ctx.config.get<LogLevel>('log.level')) ?? 'info';
    this.format = (ctx.config.get<LogFormat>('log.format')) ?? 'json';
    this.tags = ctx.config.get<Record<string, unknown>>('log.tags') ?? {};
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

  shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.tags,
      ...meta,
    };
    if (this.format === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      console.log(`[${entry.timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(meta ?? {})}`);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void { this.log('debug', message, meta); }
  info(message: string, meta?: Record<string, unknown>): void { this.log('info', message, meta); }
  warn(message: string, meta?: Record<string, unknown>): void { this.log('warn', message, meta); }
  error(message: string, meta?: Record<string, unknown>): void { this.log('error', message, meta); }

  child(tags: Record<string, unknown>): LoggerPluginAPI {
    const child = new LoggerPlugin();
    child.minLevel = this.minLevel;
    child.format = this.format;
    child.tags = { ...this.tags, ...tags };
    child.startTime = this.startTime;
    return child as unknown as LoggerPluginAPI;
  }
}

export default function createPlugin(_logger: unknown): ForgePlugin {
  return new LoggerPlugin();
}
