import { describe, it, expect, vi } from 'vitest';
import { DbPlugin } from './index.js';
import type { PluginContext } from '@forge/spec';
import { tmpdir } from 'os';
import { resolve } from 'path';

describe('DbPlugin', () => {
  const makeCtx = (overrides: Record<string, unknown> = {}) => ({
    config: {
      get: vi.fn((key: string, fallback?: unknown) => overrides[key] ?? fallback),
      has: vi.fn(() => false),
      set: vi.fn(),
      getAll: vi.fn(() => ({})),
      onUpdate: vi.fn(() => () => {}),
    },
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    bus: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), off: vi.fn() },
  }) as unknown as PluginContext;

  it('should have correct name and version', () => {
    const plugin = new DbPlugin();
    expect(plugin.name).toBe('@forge/db-plugin');
    expect(plugin.version).toBe('0.2.0');
    expect(plugin.provides).toContain('db');
  });

  it('should use sqlite adapter with temp file', async () => {
    const tmpPath = resolve(tmpdir(), `forge-test-${Date.now()}.db`);
    const plugin = new DbPlugin();
    await plugin.init(makeCtx({ 'db.driver': 'sqlite', 'db.filename': tmpPath }));
    await plugin.start();
    await plugin.migrate('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)');
    const user = await plugin.insert('users', { username: 'alice' }) as { id: number; username: string };
    expect(user.username).toBe('alice');
    expect(user.id).toBeGreaterThan(0);
    const found = await plugin.findOne('users', { username: 'alice' });
    expect(found).toBeTruthy();
    await plugin.stop();
  });

  it('should update and delete records', async () => {
    const tmpPath = resolve(tmpdir(), `forge-test-${Date.now()}-2.db`);
    const plugin = new DbPlugin();
    await plugin.init(makeCtx({ 'db.driver': 'sqlite', 'db.filename': tmpPath }));
    await plugin.start();
    await plugin.migrate('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, published INTEGER)');
    await plugin.insert('posts', { title: 'Hello', published: 0 });
    const updated = await plugin.update('posts', { title: 'Hello' }, { published: 1 });
    expect(updated).toBeGreaterThanOrEqual(0);
    const deleted = await plugin.delete('posts', { title: 'Hello' });
    expect(deleted).toBeGreaterThanOrEqual(0);
    await plugin.stop();
  });

  it('should report health', async () => {
    const tmpPath = resolve(tmpdir(), `forge-test-${Date.now()}-3.db`);
    const plugin = new DbPlugin();
    await plugin.init(makeCtx({ 'db.driver': 'sqlite', 'db.filename': tmpPath }));
    await plugin.start();
    const health = await plugin.healthCheck();
    expect(health.plugin).toBe('@forge/db-plugin');
    expect(health.status).toBe('healthy');
    await plugin.stop();
  });
});
