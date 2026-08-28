import { ApiGatewayPlugin } from '@forge/api-gateway-plugin';
import { DbPlugin } from '@forge/db-plugin';
import { AuthPlugin } from '@forge/auth-plugin';
import type { PluginBusAPI } from '@forge/spec';

export function registerHandlers(
  api: ApiGatewayPlugin,
  db: DbPlugin,
  auth: AuthPlugin,
  bus: PluginBusAPI
) {
  // GET /posts — list all posts
  api.registerRoute(
    { method: 'GET', path: '/posts', handler: 'listPosts', description: 'List all blog posts' },
    async (_params, _body) => {
      const posts = await db.find('posts', {});
      return { posts };
    }
  );

  // GET /posts/:slug — get post by slug
  api.registerRoute(
    { method: 'GET', path: '/posts/:slug', handler: 'getPost', description: 'Get a post by slug' },
    async (params) => {
      const post = await db.findOne('posts', { slug: params.slug });
      if (!post) throw Object.assign(new Error('Post not found'), { statusCode: 404 });
      return { post };
    }
  );

  // POST /posts — create post (JWT required)
  api.registerRoute(
    { method: 'POST', path: '/posts', handler: 'createPost', description: 'Create a new post (auth required)' },
    authMiddleware(auth, async (params, body, _query) => {
      const { title, slug, content } = body as { title: string; slug: string; content: string };
      if (!title || !slug || !content) {
        throw Object.assign(new Error('Missing required fields: title, slug, content'), { statusCode: 400 });
      }
      const user = await db.findOne('users', { username: (body as any).username ?? 'anonymous' });
      const authorId = (user as any)?.id ?? 1;
      const post = await db.insert('posts', { title, slug, content, authorId, createdAt: new Date().toISOString() });
      bus.emit('post:created', { post });
      return { post };
    })
  );

  // POST /auth/login — authenticate and get JWT
  api.registerRoute(
    { method: 'POST', path: '/auth/login', handler: 'login', description: 'Login with username/password, returns JWT' },
    async (_params, body) => {
      const { username, password } = body as { username: string; password: string };
      if (!username || !password) {
        throw Object.assign(new Error('Missing username or password'), { statusCode: 400 });
      }
      const user = await db.findOne('users', { username }) as { id: number; username: string; passwordHash: string } | null;
      if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

      const valid = await auth.verifyPassword(password, user.passwordHash);
      if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

      const token = auth.sign({ sub: String(user.id), username: user.username });
      bus.emit('auth:login', { userId: String(user.id), username });
      return { token, userId: user.id, username: user.username };
    }
  );

  // POST /auth/register — register a new user
  api.registerRoute(
    { method: 'POST', path: '/auth/register', handler: 'register', description: 'Register a new user' },
    async (_params, body) => {
      const { username, password } = body as { username: string; password: string };
      if (!username || !password) throw Object.assign(new Error('Missing username or password'), { statusCode: 400 });
      if (password.length < 6) throw Object.assign(new Error('Password must be at least 6 characters'), { statusCode: 400 });

      const existing = await db.findOne('users', { username });
      if (existing) throw Object.assign(new Error('Username already taken'), { statusCode: 409 });

      const passwordHash = await auth.hashPassword(password);
      const user = await db.insert('users', { username, passwordHash, createdAt: new Date().toISOString() });
      const token = auth.sign({ sub: String((user as any).id), username });
      bus.emit('user:registered', { username });
      return { token, userId: (user as any).id, username };
    }
  );
}

// Wrapper: auth middleware + handler
function authMiddleware(auth: AuthPlugin, handler: (params: Record<string, string>, body: unknown, query: Record<string, string>) => unknown) {
  return async (params: Record<string, string>, body: unknown, query: Record<string, string>, req?: any) => {
    const token = req?.headers?.['authorization']?.replace('Bearer ', '');
    if (!token) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    try {
      const payload = await auth.verify(token);
      (body as any)._auth = payload;
      return handler(params, body, query);
    } catch {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    }
  };
}
