import { describe, it, expect, vi } from 'vitest';
import { AuthPlugin } from './index.js';
import type { PluginContext } from '@forge/spec';

describe('AuthPlugin', () => {
  const makeCtx = (overrides: Record<string, unknown> = {}) => ({
    config: {
      get: vi.fn((key: string, fallback?: unknown) => overrides[key] ?? fallback),
      has: vi.fn(() => false), set: vi.fn(), getAll: vi.fn(() => ({})),
      onUpdate: vi.fn(() => () => {}),
    },
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    bus: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), off: vi.fn() },
  }) as unknown as PluginContext;

  it('should sign and verify a JWT token', async () => {
    const plugin = new AuthPlugin();
    await plugin.init(makeCtx({ 'auth.jwtSecret': 'test-secret', 'auth.jwtExpiresIn': '1h' }));
    await plugin.start();

    const token = plugin.sign({ sub: 'user-123', username: 'alice' });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT has 3 parts

    const payload = await plugin.verify(token);
    expect(payload.sub).toBe('user-123');
    expect(payload.username).toBe('alice');
    await plugin.stop();
  });

  it('should reject an invalid token', async () => {
    const plugin = new AuthPlugin();
    await plugin.init(makeCtx({ 'auth.jwtSecret': 'test-secret' }));
    await plugin.start();

    await expect(plugin.verify('invalid.token.here')).rejects.toThrow('JWT verification failed');
    await plugin.stop();
  });

  it('should reject a token signed with a different secret', async () => {
    const plugin1 = new AuthPlugin();
    await plugin1.init(makeCtx({ 'auth.jwtSecret': 'secret-1' }));
    await plugin1.start();

    const plugin2 = new AuthPlugin();
    await plugin2.init(makeCtx({ 'auth.jwtSecret': 'secret-2' }));
    await plugin2.start();

    const token = plugin1.sign({ sub: 'user-1' });
    await expect(plugin2.verify(token)).rejects.toThrow('JWT verification failed');

    await plugin1.stop();
    await plugin2.stop();
  });

  it('should hash and verify passwords', async () => {
    const plugin = new AuthPlugin();
    await plugin.init(makeCtx());
    const hash = await plugin.hashPassword('my-secret-password');
    expect(hash).not.toBe('my-secret-password');
    expect(await plugin.verifyPassword('my-secret-password', hash)).toBe(true);
    expect(await plugin.verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('should report healthy', async () => {
    const plugin = new AuthPlugin();
    await plugin.init(makeCtx());
    await plugin.start();
    const health = await plugin.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.plugin).toBe('@forge/auth-plugin');
    await plugin.stop();
  });
});
