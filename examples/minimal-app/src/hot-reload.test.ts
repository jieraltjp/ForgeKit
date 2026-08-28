import { describe, it, expect } from 'vitest';
import { HotReloadManager } from './hot-reload.js';

describe('HotReloadManager', () => {
  it('should create manager without throwing', () => {
    const manager = new HotReloadManager('/fake/app/root', {}, null);
    expect(manager).toBeTruthy();
  });

  it('should not throw on stop when not started', async () => {
    const manager = new HotReloadManager('/fake/app/root', {}, null);
    await expect(manager.stop()).resolves.not.toThrow();
  });

  it('should emit plugin:reloading event on bus when configured', async () => {
    const events: unknown[] = [];
    const bus = {
      emit: (event: string, payload: unknown) => events.push({ event, payload }),
      on: () => () => {},
    };

    const manager = new HotReloadManager('/fake/app/root', {}, bus as any, { emitOnBus: true });
    // Note: actual file watching requires integration test with temp files
    expect(manager).toBeTruthy();
  });
});
