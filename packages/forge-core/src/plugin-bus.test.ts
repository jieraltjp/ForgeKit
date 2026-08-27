import { describe, it, expect, vi } from 'vitest';
import { PluginBus } from './plugin-bus.js';

describe('PluginBus', () => {
  it('should emit to registered handlers', () => {
    const bus = new PluginBus();
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('test:event', { foo: 'bar' });
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('should return unsubscribe function', () => {
    const bus = new PluginBus();
    const handler = vi.fn();
    const unsub = bus.on('test', handler);
    unsub();
    bus.emit('test', null);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should fire once handlers only once', () => {
    const bus = new PluginBus();
    const handler = vi.fn();
    bus.once('once:test', handler);
    bus.emit('once:test', null);
    bus.emit('once:test', null);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should no-op when emitting with no handlers', () => {
    const bus = new PluginBus();
    expect(() => bus.emit('nonexistent', null)).not.toThrow();
  });

  it('should no-op off() with unregistered handler', () => {
    const bus = new PluginBus();
    expect(() => bus.off('test', () => {})).not.toThrow();
  });
});
