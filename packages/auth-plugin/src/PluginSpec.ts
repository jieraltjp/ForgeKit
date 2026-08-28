import type { PluginSpec } from '@forge/spec';

export const authPluginSpec: PluginSpec = {
  tier: 'core',
  api: [
    {
      name: 'auth.verify',
      description: 'Verify and decode a JWT token. Throws if expired or tampered.',
      parameters: [
        { name: 'token', type: 'string', required: true, description: 'Raw JWT string (without Bearer prefix)' },
      ],
      returns: 'Promise<JwtPayload> — decoded payload with sub (user id), username, roles, iat, exp',
      example: `const payload = await ctx.auth.verify(token); ctx.logger.info('Authenticated user', { userId: payload.sub });`,
    },
    {
      name: 'auth.sign',
      description: 'Sign a payload into a JWT token using the configured secret and algorithm.',
      parameters: [
        { name: 'payload', type: 'JwtPayload', required: true, description: 'Token payload — must include sub (user id)' },
        { name: 'expiresIn', type: 'string', required: false, description: 'Override token TTL, e.g. "1h", "7d". Default: "7d"' },
      ],
      returns: 'string — signed JWT token',
      example: `const token = ctx.auth.sign({ sub: userId, username: 'alice', roles: ['author'] });`,
    },
    {
      name: 'auth.middleware',
      description: 'Returns a RouteHandler that guards HTTP routes. Reads Authorization: Bearer <token> from request headers. Throws { statusCode: 401 } on failure.',
      parameters: [],
      returns: 'RouteHandler — use as middleware for protected routes',
      example: `// In api-gateway or route registration:
registerRoute({ method: 'POST', path: '/posts', handler: 'createPost' }, authMiddleware());`,
    },
    {
      name: 'auth.hashPassword',
      description: 'Hash a plaintext password using bcrypt (cost factor 10).',
      parameters: [{ name: 'password', type: 'string', required: true, description: 'Plaintext password to hash' }],
      returns: 'Promise<string> — bcrypt hash',
      example: `const hash = await ctx.auth.hashPassword(plaintext);`,
    },
    {
      name: 'auth.verifyPassword',
      description: 'Verify a plaintext password against a bcrypt hash.',
      parameters: [
        { name: 'password', type: 'string', required: true, description: 'Plaintext password to verify' },
        { name: 'hash', type: 'string', required: true, description: 'Bcrypt hash to compare against' },
      ],
      returns: 'Promise<boolean>',
      example: `const valid = await ctx.auth.verifyPassword(input, storedHash);`,
    },
  ],
  dataModels: [
    {
      name: 'JwtPayload',
      description: 'Standard JWT payload structure',
      fields: [
        { name: 'sub', type: 'string', description: 'Subject — user ID (required)' },
        { name: 'username', type: 'string', description: 'Username (optional)' },
        { name: 'roles', type: 'string[]', description: 'User roles (optional)' },
        { name: 'iat', type: 'number', description: 'Issued at timestamp' },
        { name: 'exp', type: 'number', description: 'Expiration timestamp' },
      ],
    },
  ],
  events: [
    { name: 'auth:login', description: 'Emitted on successful JWT verification', payloadType: '{ userId: string; username?: string }' },
    { name: 'auth:token-verified', description: 'Emitted after token is verified', payloadType: '{ sub: string }' },
    { name: 'auth:error', description: 'Emitted on auth failure', payloadType: '{ error: string; reason: string }' },
  ],
  dependencies: [
    {
      plugin: '@forge/config-plugin',
      type: 'required',
      integration: 'Reads auth.jwtSecret, auth.jwtExpiresIn, auth.jwtAlgorithm from ctx.config',
      example: `this.secret = ctx.config.get('auth.jwtSecret', 'change-me-in-production');`,
    },
  ],
  usageExamples: [
    {
      title: 'Protect a route with JWT middleware',
      description: 'Register a protected POST /posts endpoint using auth.middleware().',
      code: `// Route handler for POST /posts (JWT required)
// Middleware validates token before handler runs
const authResult = await ctx.auth.middleware()(params, body, query, { headers: req.headers });
if (!authResult.authorized) throw new HttpError(401, 'Unauthorized');
// authResult.user contains the verified JWT payload`,
    },
    {
      title: 'Sign a JWT on login',
      description: 'After validating credentials, sign a JWT for the client.',
      code: `// POST /auth/login handler
const { username, password } = body;
const user = await ctx.db.findOne('users', { username });
if (!user) throw new HttpError(401, 'Invalid credentials');
const valid = await ctx.auth.verifyPassword(password, user.passwordHash);
if (!valid) throw new HttpError(401, 'Invalid credentials');
const token = ctx.auth.sign({ sub: String(user.id), username: user.username });
ctx.bus.emit('auth:login', { userId: String(user.id), username });
return { token };`,
    },
    {
      title: 'Extract user from verified token',
      description: 'Use ctx.auth.verify() directly in a handler.',
      code: `async function getMe(params: Record<string,string>, body: unknown, query: Record<string,string>, req: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const payload = await ctx.auth.verify(token);
  const user = await ctx.db.findOne('users', { id: Number(payload.sub) });
  return { user };
}`,
    },
  ],
};
