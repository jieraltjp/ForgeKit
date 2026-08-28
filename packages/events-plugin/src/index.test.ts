import { describe, it, expect, vi } from 'vitest';
import { EventsPlugin } from './index.js';
import type { PluginContext } from '@forge/spec';

describe('EventsPlugin', () => {
  const makeCtx = (overrides: Record<string, unknown> = {}) => ({
    config: {
      get: vi.fn((key: string, fallback?: unknown) => overrides[key] ?? fallback),
      has: vi.fn(() => false), set: vi.fn(), getAll: vi.fn(() => ({})),
      onUpdate: vi.fn(() => () => {}),
    },
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    bus: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), off: vi.fn() },
  }) as unknown as PluginContext;

  it('should have correct name and provide events capability', () => {
    const plugin = new EventsPlugin();
    expect(plugin.name).toBe('@forge/events-plugin');
    expect(plugin.provides).toContain('events');
  });

  it('should emit and receive events locally', async () => {
    const plugin = new EventsPlugin() as any;
    await plugin.init(makeCtx({ 'events.adapter': 'memory' }));
    await plugin.start();

    const received: unknown[] = [];
    plugin.on('test:event', (p: unknown) => received.push(p));
    plugin.emit('test:event', { foo: 'bar' });
    plugin.emit('test:event', { baz: 42 });

    await new Promise(r => setTimeout(r, 10));
    expect(received.length).toBe(2);
    expect(received[0]).toEqual({ foo: 'bar' });
    expect(received[1]).toEqual({ baz: 42 });
    await plugin.stop();
  });

  it('should unsubscribe via returned function', async () => {
    const plugin = new EventsPlugin() as any;
    await plugin.init(makeCtx({ 'events.adapter': 'memory' }));
    await plugin.start();

    const received: unknown[] = [];
    const unsub = plugin.on('test:event', (p: unknown) => received.push(p));
    plugin.emit('test:event', { v: 1 });
    unsub();
    plugin.emit('test:event', { v: 2 });

    await new Promise(r => setTimeout(r, 10));
    expect(received.length).toBe(1);
    expect(received[0]).toEqual({ v: 1 });
    await plugin.stop();
  });

  it('should report healthy', async () => {
    const plugin = new EventsPlugin();
    await plugin.init(makeCtx({ 'events.adapter': 'memory' }));
    await plugin.start();
    const health = await plugin.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.plugin).toBe('@forge/events-plugin');
    await plugin.stop();
  });
});
