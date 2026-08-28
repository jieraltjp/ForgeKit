# Architecture

This document describes ForgeKit's internal architecture — how plugins are loaded, wired, and communicate.

---

## Plugin Lifecycle

Every plugin follows a strict three-phase lifecycle:

```
┌──────────────────────────────────────────────────────┐
│                    forge:init                         │
│  All plugins initialized in dependency order          │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                   forge:ready                         │
│  All plugins started, app is serving                  │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                 forge:stopping                        │
│  All plugins stopped in REVERSE dependency order     │
└──────────────────────────────────────────────────────┘
```

### Phase 1: `init(ctx)`

Receives the shared `PluginContext`. Called once at startup, before any plugin starts.

```typescript
async init(ctx: PluginContext): Promise<void>
```

What to do in `init()`:
- Read configuration (`ctx.config.get()`)
- Set up event listeners on the bus (`ctx.bus.on()`)
- Register routes with the API gateway (Phase 2+)
- Acquire resources (database connections, file handles)

What NOT to do in `init()`:
- Start long-running processes (use `start()`)
- Open network listeners (use `start()`)
- Perform health checks (use `healthCheck()`)

### Phase 2: `start()`

Called after all plugins have been initialized. Safe to start network listeners, background workers.

```typescript
async start(): Promise<void>
```

### Phase 3: `stop()`

Called in reverse dependency order on shutdown (SIGINT/SIGTERM). Release all resources.

```typescript
async stop(): Promise<void>
```

```typescript
// Example: proper resource cleanup
async stop(): Promise<void> {
  await this.dbClient.close();
  await this.server.close();
}
```

### Phase 4: `healthCheck()`

Called by the API gateway's `/health` endpoint. Return plugin health status.

```typescript
async healthCheck(): Promise<HealthStatus>
// Returns: { status: 'healthy'|'degraded'|'unhealthy', plugin, version, uptime, checks? }
```

---

## PluginContext

The `PluginContext` is the single shared object injected into every plugin at `init()` time.

```typescript
interface PluginContext {
  config: ConfigPluginAPI;   // Key-value config store
  logger: LoggerPluginAPI;    // Structured logger
  bus: PluginBusAPI;          // Pub/sub event bus
}
```

### Context injection graph

```
PluginBus (singleton, created first)
       │
       ├──► ConfigPlugin ──► ctx.config
       │
       ├──► LoggerPlugin ──► ctx.logger
       │
       └──► ApiGatewayPlugin ──► ctx.bus
                │
                └──► (all plugins receive the SAME bus instance)
```

Every plugin — regardless of its position in the dependency tree — receives the **same** `ConfigPluginAPI`, `LoggerPluginAPI`, and `PluginBusAPI` instances. This is the foundation of loose coupling.

---

## Plugin Bus

The `PluginBus` is an in-memory pub/sub system. Plugins use it to communicate without knowing about each other directly.

```typescript
interface PluginBusAPI {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: EventHandler): () => void;  // returns unsubscribe
  once(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
}
```

### Communication patterns

**Pattern 1: Direct pub/sub (most common)**

```typescript
// In config-plugin:
ctx.bus.emit('config:updated', { key: 'log.level', value: 'debug', plugin: 'config-plugin' });

// In logger-plugin:
ctx.bus.on('config:updated', (payload) => {
  if (payload.key === 'log.level') this.minLevel = payload.value;
});
```

**Pattern 2: Request/response via events**

```typescript
// Sender
const responseHandler = (payload: unknown) => { /* handle response */ };
ctx.bus.once('my-plugin:response', responseHandler);
ctx.bus.emit('other-plugin:request', { data: 'hello' });

// Receiver
ctx.bus.on('other-plugin:request', async (payload) => {
  const result = await doWork(payload);
  ctx.bus.emit('my-plugin:response', result);
});
```

**Pattern 3: Lifecycle event listeners**

```typescript
// Listen for when the app is fully ready
ctx.bus.once('forge:ready', (payload) => {
  ctx.logger.info('App is ready', { app: payload.app });
});

// Listen for any plugin errors
ctx.bus.on('plugin:error', (payload) => {
  ctx.logger.error('Plugin error', { plugin: payload.plugin, error: payload.error });
});
```

### Standard events

| Event | Emitted by | Payload |
|---|---|---|
| `forge:init` | forge-core | `{ app: string }` |
| `forge:ready` | App bootstrap | `{ app: string, plugins: string[] }` |
| `forge:stopping` | App shutdown | `{}` |
| `forge:stopped` | App shutdown | `{}` |
| `plugin:init` | PluginLifecycle | `{ plugin, version, duration }` |
| `plugin:started` | PluginLifecycle | `{ plugin, version, duration }` |
| `plugin:stopped` | PluginLifecycle | `{ plugin, version, duration }` |
| `plugin:error` | PluginLifecycle | `{ plugin, version, error }` |
| `config:updated` | ConfigPlugin | `{ key, value, plugin }` |
| `http:request` | ApiGatewayPlugin | `{ method, path }` |
| `http:response` | ApiGatewayPlugin | `{ method, path, statusCode, duration_ms }` |

---

## Dependency Resolution

Plugins declare dependencies in `plugin.yaml`:

```yaml
dependencies:
  - @forge/config-plugin
  - @forge/logger-plugin
```

The `PluginRegistry` performs:

1. **Validation** — every listed dependency must exist in `forge.json`
2. **Cycle detection** — if A depends on B and B depends on A, throw `PLUGIN_DEP_CYCLE`
3. **Topological sort** — compute the init/start order; stop order is the reverse

```
Dependency graph:                  Init order:
                                   ┌────────────┐
config-plugin ───────┐             │ config     │ ← init #1, start #1
                    ▼              │ logger     │ ← init #2, start #2
logger-plugin ──────┼──► api-gateway-plugin   │ api-gateway │ ← init #3, start #3
                    │              └────────────┘
                    │
                    └──► (no dep on config directly, but receives same context)
```

If a plugin has no dependencies, it can be initialized first.

---

## Plugin Registry

The `PluginRegistry` reads `plugin.yaml` from each plugin directory and:

- Builds a manifest map: `pluginName → PluginManifest`
- Validates all `dependencies[]` exist
- Computes `getLoadOrder()` via Kahn's algorithm (topological sort)
- Throws on cycle detection

```typescript
const registry = new PluginRegistry('./forge.json', loggerPlugin);
await registry.loadManifests();
registry.validateDependencies();  // throws PLUGIN_DEP_MISSING or PLUGIN_DEP_CYCLE
const order = registry.getLoadOrder();  // ['config-plugin', 'logger-plugin', 'api-gateway-plugin']
```

---

## Plugin Loader

The `PluginLoader` dynamically imports plugin entry points using the factory convention:

```typescript
// Entry file MUST export:
export default function createPlugin(logger: LoggerPluginAPI): ForgePlugin;
```

```typescript
const loader = new PluginLoader('./packages');
const plugin = await loader.loadPlugin({
  name: '@forge/config-plugin',
  version: '0.1.0',
  entry: './dist/index.js',
  dependencies: [],
  provides: ['config'],
  events: ['config:updated'],
});
```

The loader:
- Dynamically imports the entry file
- Calls `createPlugin(ctx.logger)`
- Returns the plugin instance
- Wraps errors in `ForgeError(PLUGIN_LOAD_FAILED)` with the original error as `cause`

---

## Config Plugin

The config plugin is a flat key-value store with three data sources, merged in priority order:

```
Priority 1 (highest):  Runtime set() calls     → ctx.config.set('key', value)
Priority 2:             FORGE_* env vars        → FORGE_LOG_LEVEL=debug
Priority 3 (lowest):    Defaults from forge.json → globalConfig in forge.json
```

### Environment variable mapping

```
FORGE_LOG_LEVEL=debug     →  config.set('log.level', 'debug')
FORGE_SERVER_PORT=8080    →  config.set('server.port', 8080)
FORGE_DB__HOST=localhost  →  config.set('db.host', 'localhost')
                                     ↑ double underscore = dot notation
```

---

## Logger Plugin

The logger plugin outputs structured JSON to stdout by default.

```typescript
// Default output (JSON)
ctx.logger.info('Server started', { port: 3000 });
// → {"level":"info","message":"Server started","timestamp":"...","port":3000}
```

### Child loggers

```typescript
const dbLogger = ctx.logger.child({ subsystem: 'database' });
dbLogger.info('Query executed', { query: 'SELECT *', duration_ms: 42 });
// → {"level":"info","message":"Query executed","subsystem":"database","query":"SELECT *","duration_ms":42}
```

Child loggers inherit parent tags and add their own. The child is a new logger instance — changing log level on the parent does not affect the child.

### Log levels

```
debug < info < warn < error
```

Set via `config.get('log.level', 'info')`.

---

## API Gateway Plugin

The API gateway is the HTTP entry point for ForgeKit applications.

### Route matching

Routes are matched in order:

1. **Exact match** — `GET /health` matches exactly
2. **Parametric match** — `GET /users/:id` matches `GET /users/123` with `{ id: '123' }`
3. **404** — no route matched

### Request context

All handlers receive:

```typescript
type RouteHandler = (
  params: Record<string, string>,    // extracted from path like /users/:id
  body: unknown,                     // parsed JSON body (POST/PUT/PATCH)
  query: Record<string, string>     // query string params
) => unknown | Promise<unknown>;
```

### Response format

All responses follow a consistent envelope:

```json
// Success:
{ "data": <result>, "statusCode": 200 }

// Error:
{ "error": { "code": "FORGE011", "message": "Route GET /foo not found" }, "statusCode": 404 }
```

### Standard error codes

| Code | Meaning |
|---|---|
| `FORGE001` | Plugin init/start/stop failed |
| `FORGE004` | Plugin not found |
| `FORGE005` | Plugin dependency missing |
| `FORGE006` | Plugin dependency cycle |
| `FORGE007` | Plugin load failed |
| `FORGE010` | Route already registered |
| `FORGE011` | Route not found |
| `FORGE012` | Config key not found |

---

## Extension Points

### Adding a new core plugin

1. Create `packages/<name>-plugin/`
2. Implement `ForgePlugin` interface
3. Write `PluginSpec.ts` with full API documentation
4. Add to `forge.json` in minimal-app
5. Add tests
6. Add to `docs/PLUGIN_SPEC.md` if it introduces new patterns

### Adding a plugin route

Phase 2+: Plugins declare `routes: RouteDefinition[]` and the API gateway registers them automatically at startup.

### Custom event types

Define custom events in your plugin's `PluginSpec.events[]`. Emit them via `ctx.bus.emit()`.

---

## Phase 2+ Roadmap

| Feature | Description |
|---|---|
| `forge-cli` | `forge new plugin`, `forge check`, `forge generate` |
| Dynamic plugin loading | Load plugins from `node_modules` by package name |
| Hot reload | Watch mode — reload changed plugins without restart |
| `@forge/db-plugin` | Database abstraction (SQL + NoSQL adapters via spec) |
| `@forge/auth-plugin` | JWT authentication |
| `@forge/events-plugin` | Redis-backed event bus adapter |
| Plugin spec generator | Auto-generate `PluginSpec.ts` from code |

---

## Phase 2 Plugins

### @forge/db-plugin — Database Abstraction

The DB plugin provides a unified interface across SQLite, PostgreSQL, and MongoDB.
AI agents never need to know which DB driver is in use — they follow the PluginSpec.

Key config keys:
- `db.driver`: 'sqlite' | 'pg' | 'mysql' | 'mongodb'
- `db.filename`: SQLite data file path (default: `data/forge.db`)
- `db.connectionString`: Connection URI for mongodb/pg/mysql

Usage from any plugin:
```typescript
// Read a post by slug — works with any DB driver
const post = await ctx.db.findOne('posts', { slug: params.slug });

// Create a new post
const newPost = await ctx.db.insert('posts', { title, slug, content, authorId: 1 });

// Run migrations
await ctx.db.migrate('CREATE TABLE ...');
```

### @forge/auth-plugin — JWT Authentication

Provides `ctx.auth.sign()`, `ctx.auth.verify()`, `ctx.auth.middleware()`, `ctx.auth.hashPassword()`, `ctx.auth.verifyPassword()`.

Key config keys:
- `auth.jwtSecret`: signing secret (REQUIRED in production)
- `auth.jwtExpiresIn`: token TTL, default `'7d'`
- `auth.jwtAlgorithm`: signing algorithm, default `'HS256'`

### @forge/events-plugin — Event Bus (Distributed)

Provides the same `PluginBusAPI` interface as `PluginBus` but supports Redis pub/sub
for multi-instance deployments.

Key config keys:
- `events.adapter`: 'memory' (default) | 'redis'
- `events.redisUrl`: Redis connection URL

## forge-cli

The ForgeKit CLI (`@forge/cli`) provides all developer tooling:

| Command | Description |
|---|---|
| `forge new plugin <name>` | Scaffold a new plugin in `packages/<name>/` |
| `forge check --plugin <name>` | Validate PluginSpec compliance, output JSON/text |
| `forge generate <plugin> <component>` | Generate `src/handlers/<component>.ts` |
| `forge list` | Print plugins from forge.json |
| `forge run` | Execute app dist/index.js |

## Dynamic Plugin Loading

Phase 2 replaces hardcoded plugin instantiation with `PluginLoader`.

`PluginLoader` resolves plugin sources from:
1. **Workspace paths**: `../../packages/config-plugin` → resolved relative to app root
2. **npm packages**: `@forge/db-plugin` → resolved via node_modules
3. **Absolute paths**: `/opt/plugins/my-plugin` → used as-is

The loader reads `plugin.yaml` and `package.json` to determine entry points,
then uses Node.js dynamic `import()` with `file://` URLs for Windows compatibility.

## Hot Reload

The `HotReloadManager` (`examples/minimal-app/src/hot-reload.ts`) watches plugin
source directories using chokidar. On change:
1. Debounce 500ms
2. Run `pnpm --filter @forge/<name> build`
3. Emit `plugin:reloading` on the bus
4. Call `plugin.stop()` and re-init
5. Emit `plugin:reloaded` on the bus

Enable via `app.hotReload = true` in config or `buildApp(path, { hotReload: true })`.
