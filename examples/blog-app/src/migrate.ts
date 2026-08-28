import { DbPlugin } from '@forge/db-plugin';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

export async function runMigrations(appRoot: string) {
  const dataDir = resolve(appRoot, 'data');
  mkdirSync(dataDir, { recursive: true });

  const db = new DbPlugin();
  const mockCtx = {
    config: {
      get: (key: string, fallback?: unknown) => {
        if (key === 'db.driver') return 'sqlite';
        if (key === 'db.filename') return resolve(dataDir, 'blog.db');
        return fallback;
      },
      has: () => false,
      set: () => {},
      getAll: () => ({}),
      onUpdate: () => () => {},
    },
    logger: { info: console.log, debug: () => {}, warn: console.warn, error: console.error, child: () => ({}) as any },
    bus: { emit: () => {}, on: () => () => {}, once: () => {}, off: () => {} },
  } as any;

  await db.init(mockCtx);
  await db.start();

  await db.migrate(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      authorId INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (authorId) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
    CREATE INDEX IF NOT EXISTS idx_posts_authorId ON posts(authorId);
  `);

  console.log('Migrations complete.');
  await db.stop();
}
