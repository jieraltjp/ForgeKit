import { describe, it, expect, vi } from 'vitest';
import { ConfigPlugin } from './index.js';

describe('ConfigPlugin', () => {
  it('should return undefined for missing key', () => {
    const plugin = new ConfigPlugin();
    expect(plugin.get('missing')).toBeUndefined();
  });

  it('should return fallback for missing key', () => {
    const plugin = new ConfigPlugin();
    expect(plugin.get('missing', 'default')).toBe('default');
  });

  it('should set and get values', () => {
    const plugin = new ConfigPlugin();
    plugin.set('foo', 'bar');
    expect(plugin.get('foo')).toBe('bar');
  });

  it('should notify watchers on set', () => {
    const plugin = new ConfigPlugin();
    const watcher = vi.fn();
    plugin.onUpdate(watcher);
    plugin.set('x', 1);
    expect(watcher).toHaveBeenCalledWith('x', 1);
  });

  it('should return all config as object', async () => {
    const plugin = new ConfigPlugin({ a: 1, b: 2 });
    // defaults are seeded into the map during init()
    await plugin.init({
      config: plugin as never,
      logger: { debug() {}, info() {}, warn() {}, error() {}, child() { return this; } } as never,
      bus: { emit() {}, on() { return () => {}; }, once() {}, off() {} } as never,
    });
    expect(plugin.getAll()).toEqual({ a: 1, b: 2 });
  });
});
