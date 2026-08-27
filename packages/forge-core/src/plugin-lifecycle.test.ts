import { describe, it, expect, vi } from 'vitest';
import { PluginLifecycle } from './plugin-lifecycle.js';
import { PluginBus } from './plugin-bus.js';
import type { ForgePlugin, PluginContext, HealthStatus } from '@forge/spec';

describe('PluginLifecycle', () => {
  const makePlugin = (name: string): ForgePlugin => ({
    name,
    version: '0.1.0',
    description: 'test',
    dependencies: [],
    provides: [],
    events: [],
    init: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', plugin: name, version: '0.1.0', uptime: 0 }),
  });

  it('should init plugins in order', async () => {
    const bus = new PluginBus();
    const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() } as unknown as import('@forge/spec').LoggerPluginAPI;
    const lc = new PluginLifecycle(bus, logger);
    const p1 = makePlugin('a');
    const p2 = makePlugin('b');
    const ctx = {} as PluginContext;
    await lc.init([p1, p2], ctx);
    expect(p1.init).toHaveBeenCalledWith(ctx);
    expect(p2.init).toHaveBeenCalledWith(ctx);
  });

  it('should start plugins in order', async () => {
    const bus = new PluginBus();
    const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() } as unknown as import('@forge/spec').LoggerPluginAPI;
    const lc = new PluginLifecycle(bus, logger);
    const p1 = makePlugin('a');
    const p2 = makePlugin('b');
    await lc.start([p1, p2]);
    expect(p1.start).toHaveBeenCalled();
    expect(p2.start).toHaveBeenCalled();
  });

  it('should stop plugins in reverse order', async () => {
    const bus = new PluginBus();
    const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() } as unknown as import('@forge/spec').LoggerPluginAPI;
    const lc = new PluginLifecycle(bus, logger);
    const p1 = makePlugin('a');
    const p2 = makePlugin('b');
    await lc.stop([p1, p2]);
    expect(p2.stop).toHaveBeenCalled();
    expect(p1.stop).toHaveBeenCalled();
  });

  it('should throw if init is called twice', async () => {
    const bus = new PluginBus();
    const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() } as unknown as import('@forge/spec').LoggerPluginAPI;
    const lc = new PluginLifecycle(bus, logger);
    const p = makePlugin('a');
    const ctx = {} as PluginContext;
    await lc.init([p], ctx);
    await expect(lc.init([p], ctx)).rejects.toThrow('Plugin already initialized');
  });

  it('should emit plugin:error on init failure', async () => {
    const bus = new PluginBus();
    const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() } as unknown as import('@forge/spec').LoggerPluginAPI;
    const lc = new PluginLifecycle(bus, logger);
    const p = makePlugin('a');
    p.init = vi.fn().mockRejectedValue(new Error('boom'));
    const ctx = {} as PluginContext;
    await expect(lc.init([p], ctx)).rejects.toThrow('boom');
    const errors: unknown[] = [];
    bus.on('plugin:error', (e) => { errors.push(e); });
    // re-init to check error was emitted during first call
    const p2 = makePlugin('b');
    p2.init = vi.fn().mockRejectedValue(new Error('boom2'));
    await expect(lc.init([p2], ctx)).rejects.toThrow('boom2');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should run health checks in parallel', async () => {
    const bus = new PluginBus();
    const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() } as unknown as import('@forge/spec').LoggerPluginAPI;
    const lc = new PluginLifecycle(bus, logger);
    const p = makePlugin('a');
    const results = await lc.runHealthChecks([p]);
    expect(results.get('a')?.status).toBe('healthy');
  });
});
