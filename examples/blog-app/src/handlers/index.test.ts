import { describe, it, expect } from 'vitest';
import { AuthPlugin } from '@forge/auth-plugin';
import { DbPlugin } from '@forge/db-plugin';
import { PluginBus } from '@forge/core';
import { resolve } from 'path';
import { tmpdir } from 'os';

describe('blog-app handlers', () => {
  it('should hash and verify passwords', async () => {
    const auth = new AuthPlugin();
    const hash = await auth.hashPassword('secret123');
    expect(await auth.verifyPassword('secret123', hash)).toBe(true);
    expect(await auth.verifyPassword('wrong', hash)).toBe(false);
  });

  it('should sign and verify JWT tokens', async () => {
    const auth = new AuthPlugin();
    const token = auth.sign({ sub: 'user-1', username: 'alice' });
    const payload = await auth.verify(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.username).toBe('alice');
  });

  it('should perform db insert and find in SQLite', async () => {
    const tmpPath = resolve(tmpdir(), `blog-test-${Date.now()}.db`);
    const db = new DbPlugin();
    const mockCtx = {
      config: {
        get: (_: string, fallback: unknown) => fallback,
        has: () => false, set: () => {}, getAll: () => ({}), onUpdate: () => () => {},
      },
      logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {}, child: () => ({}) as any },
      bus: { emit: () => {}, on: () => () => {}, once: () => {}, off: () => {} },
    } as any;

    await db.init(mockCtx);
    (db as any).adapter.filename = tmpPath;
    await db.start();
    await db.migrate('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, slug TEXT UNIQUE)');
    await db.insert('posts', { title: 'Hello', slug: `hello-${Date.now()}` });
    const post = await db.findOne('posts', { title: 'Hello' });
    expect(post).toBeTruthy();
    expect((post as any).title).toBe('Hello');
    await db.stop();
  });
});
