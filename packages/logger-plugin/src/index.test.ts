import { describe, it, expect, vi } from 'vitest';
import { LoggerPlugin } from './index.js';
import type { PluginContext } from '@forge/spec';

describe('LoggerPlugin', () => {
  const makeCtx = (overrides: Partial<{ logLevel: string; logFormat: string }> = {}) => {
    return {
      config: {
        get: vi.fn((key: string, fallback?: string) => {
          if (key === 'log.level') return overrides.logLevel ?? fallback ?? 'info';
          if (key === 'log.format') return overrides.logFormat ?? fallback ?? 'json';
          if (key === 'log.tags') return undefined;
          return fallback;
        }),
        has: vi.fn(() => false),
        set: vi.fn(),
        getAll: vi.fn(() => ({})),
        onUpdate: vi.fn(() => () => {}),
      },
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
      bus: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), off: vi.fn() },
    } as unknown as PluginContext;
  };

  it('should log info by default', () => {
    const plugin = new LoggerPlugin();
    const ctx = makeCtx();
    plugin.init(ctx);
    plugin.start();
    expect(() => plugin.info('test')).not.toThrow();
  });

  it('should not log below threshold', () => {
    const plugin = new LoggerPlugin();
    const ctx = makeCtx({ logLevel: 'error' });
    plugin.init(ctx);
    plugin.start();
    expect(() => plugin.debug('debug msg')).not.toThrow();
    expect(() => plugin.info('info msg')).not.toThrow();
    expect(() => plugin.warn('warn msg')).not.toThrow();
  });

  it('should merge tags in child logger', () => {
    const plugin = new LoggerPlugin();
    const ctx = makeCtx();
    plugin.init(ctx);
    plugin.tags = { plugin: 'test' };
    plugin.start();
    const child = plugin.child({ subsystem: 'db' }) as LoggerPlugin;
    expect(child.tags).toEqual({ plugin: 'test', subsystem: 'db' });
  });

  it('should not throw for invalid levels', () => {
    const plugin = new LoggerPlugin();
    const ctx = makeCtx({ logLevel: 'invalid' as never });
    expect(() => plugin.init(ctx)).not.toThrow();
  });
});
