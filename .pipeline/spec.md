# ForgeKit Phase 1 — Implementation Spec

**Phase:** Phase 1 (v0.1.0)
**Status:** Implementation-ready
**Based on:** SPEC.md (confirmed 2026-08-27)

---

## Open Questions (Resolved for Phase 1)

| ID | Question | Resolution |
|----|----------|------------|
| OQ1 | Plugin communication protocol | REST API only (HTTP routes) |
| OQ2 | Plugin isolation | Shared process (no sandboxing in v1) |
| OQ7 | Core plugin count | 3: config, logger, api-gateway |
| OQ8 | Example app domain | Generic (minimal HTTP server) |
| OQ9 | Hot-reload in v1 | No |
| OQ2/OQ10 | Claim system / agent coordination | Deferred to Phase 2+ |
| OQ4 | Auth between plugins | Deferred (trust boundary in v1) |

---

## Project Structure

```
D:\Programme\jieralt\SeoTest\
├── pnpm-workspace.yaml
├── package.json                    # root: just workspaces + devDeps
├── tsconfig.base.json              # shared TSConfig extends
├── vitest.config.ts               # shared vitest config
├── .gitignore
├── packages/
│   ├── forge-spec/                 # Shared types, schemas, errors, events
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api-contract.ts
│   │       ├── plugin-spec.ts
│   │       ├── plugin-yaml-schema.json
│   │       ├── errors.ts
│   │       └── events.ts
│   ├── forge-core/                 # Runtime engine
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── plugin-registry.ts
│   │       ├── plugin-loader.ts
│   │       ├── plugin-lifecycle.ts
│   │       ├── plugin-bus.ts
│   │       └── plugin-context.ts
│   ├── config-plugin/              # @forge/config-plugin
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── plugin.yaml
│   │   └── src/
│   │       ├── index.ts
│   │       ├── PluginSpec.ts
│   │       └── impl.ts
│   ├── logger-plugin/              # @forge/logger-plugin
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── plugin.yaml
│   │   └── src/
│   │       ├── index.ts
│   │       ├── PluginSpec.ts
│   │       └── impl.ts
│   └── api-gateway-plugin/          # @forge/api-gateway-plugin
│       ├── package.json
│       ├── tsconfig.json
│       ├── plugin.yaml
│       └── src/
│           ├── index.ts
│           ├── PluginSpec.ts
│           └── impl.ts
└── examples/
    └── minimal-app/                 # Composes all 3 plugins
        ├── package.json
        ├── tsconfig.json
        ├── forge.json
        └── src/
            ├── index.ts
            └── App.ts
```

---

## Section 1: Monorepo Setup

### File: `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

### File: `package.json` (root)

```json
{
  "name": "forgekit",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

### File: `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### File: `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
```

---

## Section 2: forge-spec

### 2.1 `packages/forge-spec/package.json`

```json
{
  "name": "@forge/spec",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "pretest": "pnpm build"
  }
}
```

### 2.2 `packages/forge-spec/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"]
}
```

### 2.3 `packages/forge-spec/src/api-contract.ts`

Exports all plugin interface types used across forge-core and all plugins.

```typescript
// Route definition for HTTP endpoints
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  path: string;            // e.g. "/config/:key"
  handler: string;         // e.g. "getConfig"
  description: string;
  parameters?: ParameterDefinition[];
  response?: ResponseDefinition;
}

// Health check result
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  plugin: string;
  version: string;
  uptime: number;          // seconds since start()
  checks?: Record<string, boolean>;
}

// Main plugin interface — every plugin MUST implement this
export interface ForgePlugin {
  readonly name: string;           // kebab-case, unique
  readonly version: string;       // semver
  readonly description: string;
  readonly dependencies: string[]; // plugin names required
  readonly provides: string[];   // capability names this plugin provides
  readonly events: string[];     // event names this plugin emits

  init(ctx: PluginContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;

  routes?: RouteDefinition[];     // HTTP routes exposed by this plugin
}

// Shared context passed to every plugin at init time
export interface PluginContext {
  config: ConfigPluginAPI;
  logger: LoggerPluginAPI;
  bus: PluginBusAPI;
}

// Config plugin API surface exposed via PluginContext
export interface ConfigPluginAPI {
  get<T = unknown>(key: string, fallback?: T): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  getAll(): Record<string, unknown>;
  onUpdate(callback: (key: string, value: unknown) => void): () => void;
}

// Logger plugin API surface exposed via PluginContext
export interface LoggerPluginAPI {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): LoggerPluginAPI;
}

// Event bus API surface exposed via PluginContext
export interface PluginBusAPI {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: EventHandler): () => void;
  once(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
}

export type EventHandler = (payload: unknown) => void | Promise<void>;

// HTTP server API for api-gateway
export interface HttpServerAPI {
  registerRoute(route: RouteDefinition, handler: RouteHandler): void;
  start(port: number): Promise<void>;
  stop(): Promise<void>;
}

export type RouteHandler = (
  params: Record<string, string>,
  body: unknown,
  query: Record<string, string>
) => unknown | Promise<unknown>;

export interface ParameterDefinition {
  name: string;
  in: 'path' | 'query' | 'body';
  required: boolean;
  type: string;
  description?: string;
}

export interface ResponseDefinition {
  statusCode: number;
  description: string;
  schema?: string;
}
```

### 2.4 `packages/forge-spec/src/plugin-spec.ts`

PluginSpec self-documenting structure. Every plugin must provide one.

```typescript
export interface APIDefinition {
  name: string;
  description: string;
  parameters?: ParameterSpec[];
  returns: string;
  example?: string;
}

export interface ParameterSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface DataModel {
  name: string;
  description: string;
  fields: ModelField[];
}

export interface ModelField {
  name: string;
  type: string;
  description: string;
}

export interface EventDefinition {
  name: string;
  description: string;
  payloadType: string;
}

export interface DependencyDefinition {
  plugin: string;
  type: 'required' | 'optional';
  integration: string;       // how to use this dependency
  example: string;
}

export interface UsageExample {
  title: string;
  description: string;
  code: string;
}

export interface PluginSpec {
  api: APIDefinition[];
  dataModels: DataModel[];
  events: EventDefinition[];
  dependencies: DependencyDefinition[];
  usageExamples: UsageExample[];
  tier: 'core' | 'extension' | 'community';
  autogenerated?: boolean;   // set true if auto-generated from code
}
```

### 2.5 `packages/forge-spec/src/plugin-yaml-schema.json`

JSON Schema for `plugin.yaml` manifest validation.

Schema must validate these fields:
- `name` (string, required, kebab-case pattern `^[a-z][a-z0-9-]*$`)
- `version` (string, required, semver)
- `description` (string, required)
- `forgeVersion` (string, semver range)
- `dependencies` (array of plugin names, optional)
- `provides` (array of strings, optional)
- `events` (array of strings, optional)
- `entry` (string, required, path to entry JS file relative to plugin root)
- `main` (string, optional, exported class name)

### 2.6 `packages/forge-spec/src/errors.ts`

Standard error codes for ForgeKit ecosystem.

```typescript
export const ForgeErrors = {
  PLUGIN_INIT_FAILED: 'FORGE001',
  PLUGIN_START_FAILED: 'FORGE002',
  PLUGIN_STOP_FAILED: 'FORGE003',
  PLUGIN_NOT_FOUND: 'FORGE004',
  PLUGIN_DEP_MISSING: 'FORGE005',
  PLUGIN_DEP_CYCLE: 'FORGE006',
  PLUGIN_LOAD_FAILED: 'FORGE007',
  PLUGIN_HEALTH_FAILED: 'FORGE008',
  BUS_EMIT_FAILED: 'FORGE009',
  ROUTE_ALREADY_REGISTERED: 'FORGE010',
  ROUTE_NOT_FOUND: 'FORGE011',
  CONFIG_KEY_NOT_FOUND: 'FORGE012',
  CONFIG_INVALID_TYPE: 'FORGE013',
} as const;

export type ForgeErrorCode = typeof ForgeErrors[keyof typeof ForgeErrors];

export class ForgeError extends Error {
  constructor(
    public readonly code: ForgeErrorCode,
    message: string,
    public readonly plugin?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ForgeError';
  }
}
```

### 2.7 `packages/forge-spec/src/events.ts`

Standard event type constants.

```typescript
// Lifecycle events (emitted by forge-core)
export const CoreEvents = {
  FORGE_INIT: 'forge:init',
  FORGE_READY: 'forge:ready',
  FORGE_STOPPING: 'forge:stopping',
  FORGE_STOPPED: 'forge:stopped',
  PLUGIN_INIT: 'plugin:init',
  PLUGIN_STARTED: 'plugin:started',
  PLUGIN_STOPPED: 'plugin:stopped',
  PLUGIN_ERROR: 'plugin:error',
} as const;

// Lifecycle event payload types
export interface PluginLifecyclePayload {
  plugin: string;
  version: string;
  duration?: number;
  error?: string;
}
```

### 2.8 `packages/forge-spec/src/index.ts`

Public barrel export.

```typescript
export * from './api-contract.js';
export * from './plugin-spec.js';
export * from './errors.js';
export * from './events.js';
```

---

## Section 3: forge-core

### 3.1 `packages/forge-core/package.json`

```json
{
  "name": "@forge/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "dependencies": {
    "@forge/spec": "workspace:*"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "test": "vitest run"
  }
}
```

### 3.2 `packages/forge-core/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"],
  "references": [{ "path": "../forge-spec" }]
}
```

### 3.3 `packages/forge-core/src/plugin-context.ts`

Builds the PluginContext object that is passed to every plugin at init time.

```typescript
import type { PluginContext, ConfigPluginAPI, LoggerPluginAPI, PluginBusAPI } from '@forge/spec';

export interface PluginContextOptions {
  configAPI: ConfigPluginAPI;
  loggerAPI: LoggerPluginAPI;
  busAPI: PluginBusAPI;
}

export function createPluginContext(opts: PluginContextOptions): PluginContext {
  return {
    config: opts.configAPI,
    logger: opts.loggerAPI,
    bus: opts.busAPI,
  };
}
```

### 3.4 `packages/forge-core/src/plugin-bus.ts`

In-memory event bus. Pub/sub pattern.

**Constructor:** `new PluginBus()` (no arguments)

**Methods:**
- `emit(event: string, payload: unknown): void` — fire all handlers for event
- `on(event: string, handler: EventHandler): () => void` — subscribe, returns unsubscribe fn
- `once(event: string, handler: EventHandler): void` — subscribe for one emission
- `off(event: string, handler: EventHandler): void` — remove a specific handler

**Internal state:**
- `Map<string, Set<EventHandler>>` — handlers keyed by event name

**Edge cases:**
- Calling `emit` with no handlers registered: no-op, no error
- `once` handler fires exactly once then is removed from the set
- `off` with a handler that was never registered: no-op
- `on` called twice with the same handler: adds twice (deduplication is the caller's responsibility)

### 3.5 `packages/forge-core/src/plugin-registry.ts`

Reads plugin manifests, resolves dependencies, and orders plugins topologically.

**Constructor:** `new PluginRegistry(manifestPath: string, logger: LoggerPluginAPI)`

**Methods:**
- `async loadManifests(): Promise<void>` — reads each plugin's `plugin.yaml`, stores metadata
- `getManifest(name: string): PluginManifest | undefined`
- `getLoadOrder(): string[]` — topological sort, throws `ForgeError(PLUGIN_DEP_CYCLE)` on cycle
- `validateDependencies(): void` — throws `ForgeError(PLUGIN_DEP_MISSING)` if a dep is not in manifests

**Internal types:**
```typescript
interface PluginManifest {
  name: string;
  version: string;
  entry: string;
  dependencies: string[];
  provides: string[];
  events: string[];
}
```

**Edge cases:**
- Plugin lists itself as a dependency: cycle detected, throws
- A plugin depends on another not listed in `forge.json`: `PLUGIN_DEP_MISSING`
- Duplicate plugin names across manifests: last one wins, logged as warning

### 3.6 `packages/forge-core/src/plugin-loader.ts`

Dynamically loads plugin entry points from `node_modules` or relative paths.

**Constructor:** `new PluginLoader(basePath: string)`

**Methods:**
- `async loadPlugin(manifest: PluginManifest): Promise<ForgePlugin>` — imports the entry JS file, calls `createPlugin(logger)` factory, returns instance
- `async loadAll(manifests: PluginManifest[]): Promise<ForgePlugin[]>` — sequential load

**Factory convention:**
The entry file must export a default or named `createPlugin` function:
```typescript
export default function createPlugin(logger: LoggerPluginAPI): ForgePlugin;
```

**Edge cases:**
- Entry file does not export a factory: throws `ForgeError(PLUGIN_LOAD_FAILED)` with descriptive message
- Import fails (file not found, syntax error): wrapped as `ForgeError(PLUGIN_LOAD_FAILED, cause=originalError)`
- `createPlugin` throws: wrapped as `ForgeError(PLUGIN_INIT_FAILED)`

### 3.7 `packages/forge-core/src/plugin-lifecycle.ts`

Manages the full lifecycle of all plugins in dependency order.

**Constructor:** `new PluginLifecycle(bus: PluginBus, logger: LoggerPluginAPI)`

**Methods:**
- `async init(plugins: ForgePlugin[], ctx: PluginContext): Promise<void>` — calls `plugin.init(ctx)` sequentially in array order (array must be pre-sorted by registry)
- `async start(plugins: ForgePlugin[]): Promise<void>` — calls `plugin.start()` sequentially
- `async stop(plugins: ForgePlugin[]): Promise<void>` — calls `plugin.stop()` in reverse order
- `async runHealthChecks(plugins: ForgePlugin[]): Promise<Map<string, HealthStatus>>` — parallel calls to `plugin.healthCheck()`
- `async execute(plugins: ForgePlugin[], ctx: PluginContext): Promise<void>` — runs init, then start, then registers `process.on('SIGINT'/'SIGTERM', stop)`

**Edge cases:**
- `init` on a plugin that was already initialized: throw `ForgeError(PLUGIN_INIT_FAILED)` with message "Plugin already initialized"
- `start` called before all `init` calls complete: await each sequentially
- `stop` on a plugin that is not started: log warning, no-op
- Any lifecycle method throws: emit `plugin:error` event on bus, then re-throw wrapped in `ForgeError`

### 3.8 `packages/forge-core/src/index.ts`

Public barrel export.

```typescript
export { PluginBus } from './plugin-bus.js';
export { PluginRegistry } from './plugin-registry.js';
export { PluginLoader } from './plugin-loader.js';
export { PluginLifecycle } from './plugin-lifecycle.js';
export { createPluginContext } from './plugin-context.js';
```

---

## Section 4: config-plugin

### 4.1 `packages/config-plugin/package.json`

```json
{
  "name": "@forge/config-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "dependencies": {
    "@forge/spec": "workspace:*"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json"
  }
}
```

### 4.2 `packages/config-plugin/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"],
  "references": [{ "path": "../forge-spec" }]
}
```

### 4.3 `packages/config-plugin/plugin.yaml`

```yaml
name: @forge/config-plugin
version: 0.1.0
description: Centralized configuration management for ForgeKit. Loads config from JSON files and environment variables.
forgeVersion: ">=0.1.0"
dependencies: []
provides:
  - config
events:
  - config:updated
entry: ./dist/index.js
```

### 4.4 `packages/config-plugin/src/impl.ts`

**Implements:** `ForgePlugin` interface.

**State:**
- `config: Map<string, unknown>` — flat key-value store
- `watchers: Set<(key: string, value: unknown) => void>` — config change subscribers

**Constructor:** `constructor(private defaults: Record<string, unknown> = {})`

**init:** Merges defaults with process.env (env vars prefixed `FORGE_` override defaults, e.g. `FORGE_LOG_LEVEL=debug` sets `logLevel = debug`). Converts underscores in env keys to dots.

**start/stop:** No-op.

**healthCheck:** Returns `HealthStatus { status: 'healthy', plugin: '@forge/config-plugin', version: '0.1.0', uptime: ... }`.

**Provides API surface** (ConfigPluginAPI):
- `get<T>(key, fallback?)` — returns value or undefined/fallback
- `set(key, value)` — sets value, fires all watchers
- `has(key)` — returns boolean
- `getAll()` — returns plain object copy of config
- `onUpdate(fn)` — subscribes, returns unsubscribe fn

### 4.5 `packages/config-plugin/src/PluginSpec.ts`

```typescript
import type { PluginSpec } from '@forge/spec';

export const configPluginSpec: PluginSpec = {
  tier: 'core',
  api: [
    {
      name: 'config.get',
      description: 'Get a configuration value by key.',
      parameters: [
        { name: 'key', type: 'string', required: true, description: 'Dot-notation config key, e.g. "log.level"' },
        { name: 'fallback', type: 'unknown', required: false, description: 'Value returned if key is not found' },
      ],
      returns: 'unknown — the stored value, fallback, or undefined',
      example: `const level = ctx.config.get('log.level', 'info');`,
    },
    {
      name: 'config.set',
      description: 'Set a configuration value. Notifies all config subscribers.',
      parameters: [
        { name: 'key', type: 'string', required: true, description: 'Dot-notation config key' },
        { name: 'value', type: 'unknown', required: true, description: 'Value to store' },
      ],
      returns: 'void',
      example: `ctx.config.set('log.level', 'debug');`,
    },
    {
      name: 'config.has',
      description: 'Check if a configuration key exists.',
      parameters: [
        { name: 'key', type: 'string', required: true, description: 'Config key to check' },
      ],
      returns: 'boolean',
    },
    {
      name: 'config.getAll',
      description: 'Get a snapshot of all configuration as a plain object.',
      returns: 'Record<string, unknown>',
    },
    {
      name: 'config.onUpdate',
      description: 'Subscribe to configuration changes. Returns an unsubscribe function.',
      parameters: [
        { name: 'callback', type: 'function', required: true, description: 'Called on every config.set()' },
      ],
      returns: '() => void — call to unsubscribe',
    },
  ],
  dataModels: [],
  events: [
    {
      name: 'config:updated',
      description: 'Emitted on the plugin bus whenever a config value is changed via set().',
      payloadType: '{ key: string; value: unknown; plugin: string }',
    },
  ],
  dependencies: [],
  usageExamples: [
    {
      title: 'Read config at startup',
      description: 'Use config.get() inside a plugin init() to read settings.',
      code: `// my-plugin/src/impl.ts
export class MyPlugin implements ForgePlugin {
  async init(ctx: PluginContext) {
    const port = ctx.config.get<number>('server.port', 3000);
    const host = ctx.config.get<string>('server.host', '0.0.0.0');
    console.log(\`Starting on \${host}:\${port}\`);
  }
}`,
    },
    {
      title: 'Watch for config changes',
      description: 'Subscribe to runtime config updates.',
      code: `const unsubscribe = ctx.config.onUpdate((key, value) => {
  ctx.logger.info(\`Config \${key} changed to \${JSON.stringify(value)}\`);
});`,
    },
  ],
};
```

### 4.6 `packages/config-plugin/src/index.ts`

Factory entry point for forge-core loader.

```typescript
import type { ForgePlugin, PluginContext, HealthStatus } from '@forge/spec';
import { configPluginSpec } from './PluginSpec.js';

// Plugin class — exported as named export for factory pattern
export class ConfigPlugin implements ForgePlugin {
  readonly name = '@forge/config-plugin';
  readonly version = '0.1.0';
  readonly description = 'Centralized configuration management for ForgeKit';
  readonly dependencies: string[] = [];
  readonly provides: string[] = ['config'];
  readonly events: string[] = ['config:updated'];
  readonly spec = configPluginSpec;

  private config = new Map<string, unknown>();
  private watchers = new Set<(key: string, value: unknown) => void>();
  private startTime = 0;

  constructor(private defaults: Record<string, unknown> = {}) {}

  async init(ctx: PluginContext): Promise<void> {
    // Seed defaults
    for (const [k, v] of Object.entries(this.defaults)) {
      this.config.set(k, v);
    }
    // Override from environment (FORGE_KEY=value → config.key = value)
    for (const [k, v] of Object.entries(process.env)) {
      if (k.startsWith('FORGE_')) {
        const key = k.slice(6).toLowerCase().replace(/_/g, '.');
        try {
          this.config.set(key, JSON.parse(v!));
        } catch {
          this.config.set(key, v);
        }
      }
    }
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
  }

  async stop(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      plugin: this.name,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  // ConfigPluginAPI implementation
  get<T = unknown>(key: string, fallback?: T): T | undefined {
    const val = this.config.get(key);
    return (val as T) ?? fallback;
  }

  set(key: string, value: unknown): void {
    this.config.set(key, value);
    for (const w of this.watchers) {
      w(key, value);
    }
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.config);
  }

  onUpdate(callback: (key: string, value: unknown) => void): () => void {
    this.watchers.add(callback);
    return () => this.watchers.delete(callback);
  }
}

export default function createPlugin(_logger: unknown): ForgePlugin {
  return new ConfigPlugin();
}
```

---

## Section 5: logger-plugin

### 5.1 `packages/logger-plugin/package.json`

```json
{
  "name": "@forge/logger-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": "./dist/index.js" },
  "dependencies": { "@forge/spec": "workspace:*" },
  "scripts": { "build": "tsc --project tsconfig.json" }
}
```

### 5.2 `packages/logger-plugin/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"],
  "references": [{ "path": "../forge-spec" }]
}
```

### 5.3 `packages/logger-plugin/plugin.yaml`

```yaml
name: @forge/logger-plugin
version: 0.1.0
description: Structured logging with plugin tagging. Outputs JSON to stdout.
forgeVersion: ">=0.1.0"
dependencies: []
provides:
  - logger
events: []
entry: ./dist/index.js
```

### 5.4 `packages/logger-plugin/src/impl.ts`

**Implements:** `ForgePlugin`.

**State:**
- `level: 'debug' | 'info' | 'warn' | 'error'`
- `tags: Record<string, unknown>` — merged into every log line

**init:** Reads `ctx.config.get('log.level', 'info')` and `ctx.config.get('log.format', 'json')`.

**Log format (json mode):**
```json
{
  "level": "info",
  "message": "Server started",
  "timestamp": "2026-08-27T00:00:00.000Z",
  "plugin": "@forge/api-gateway-plugin",
  "meta": { "port": 8080 }
}
```

**Log format (text mode):**
`[TIMESTAMP] [LEVEL] [PLUGIN] message meta`

**start/stop:** No-op.

**healthCheck:** Returns `HealthStatus { status: 'healthy', plugin: '@forge/logger-plugin', version: '0.1.0', uptime: ... }`.

### 5.5 `packages/logger-plugin/src/PluginSpec.ts`

```typescript
import type { PluginSpec } from '@forge/spec';

export const loggerPluginSpec: PluginSpec = {
  tier: 'core',
  api: [
    {
      name: 'logger.debug',
      description: 'Log at DEBUG level.',
      parameters: [
        { name: 'message', type: 'string', required: true, description: 'Log message' },
        { name: 'meta', type: 'Record<string, unknown>', required: false, description: 'Additional structured data' },
      ],
      returns: 'void',
    },
    {
      name: 'logger.info',
      description: 'Log at INFO level.',
      parameters: [
        { name: 'message', type: 'string', required: true },
        { name: 'meta', type: 'Record<string, unknown>', required: false },
      ],
      returns: 'void',
    },
    {
      name: 'logger.warn',
      description: 'Log at WARN level.',
      parameters: [
        { name: 'message', type: 'string', required: true },
        { name: 'meta', type: 'Record<string, unknown>', required: false },
      ],
      returns: 'void',
    },
    {
      name: 'logger.error',
      description: 'Log at ERROR level.',
      parameters: [
        { name: 'message', type: 'string', required: true },
        { name: 'meta', type: 'Record<string, unknown>', required: false },
      ],
      returns: 'void',
    },
    {
      name: 'logger.child',
      description: 'Create a logger with additional persistent metadata merged in.',
      parameters: [
        { name: 'meta', type: 'Record<string, unknown>', required: true, description: 'Additional tags for every log line' },
      ],
      returns: 'LoggerPluginAPI — a new logger instance with merged tags',
    },
  ],
  dataModels: [],
  events: [],
  dependencies: [],
  usageExamples: [
    {
      title: 'Basic logging from a plugin',
      description: 'Use the logger from PluginContext to log plugin activity.',
      code: `export class MyPlugin implements ForgePlugin {
  async init(ctx: PluginContext) {
    ctx.logger.info('MyPlugin initialized', { version: this.version });
  }
}`,
    },
    {
      title: 'Tagged logger for a subsystem',
      description: 'Use child() to create a logger scoped to a subsystem.',
      code: `const dbLogger = ctx.logger.child({ subsystem: 'database' });
dbLogger.info('Query executed', { query: 'SELECT *', duration_ms: 42 });`,
    },
  ],
};
```

### 5.6 `packages/logger-plugin/src/index.ts`

```typescript
import type { ForgePlugin, PluginContext, HealthStatus } from '@forge/spec';
import { loggerPluginSpec } from './PluginSpec.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFormat = 'json' | 'text';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class LoggerPlugin implements ForgePlugin {
  readonly name = '@forge/logger-plugin';
  readonly version = '0.1.0';
  readonly description = 'Structured logging with plugin tagging';
  readonly dependencies: string[] = [];
  readonly provides: string[] = ['logger'];
  readonly events: string[] = [];
  readonly spec = loggerPluginSpec;

  private minLevel: LogLevel = 'info';
  private format: LogFormat = 'json';
  private tags: Record<string, unknown> = {};
  private startTime = 0;

  async init(ctx: PluginContext): Promise<void> {
    this.minLevel = (ctx.config.get<LogLevel>('log.level')) ?? 'info';
    this.format = (ctx.config.get<LogFormat>('log.format')) ?? 'json';
    this.tags = ctx.config.get<Record<string, unknown>>('log.tags') ?? {};
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
  }

  async stop(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      plugin: this.name,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.tags,
      ...meta,
    };
    if (this.format === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      console.log(`[${entry.timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(meta ?? {})}`);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void { this.log('debug', message, meta); }
  info(message: string, meta?: Record<string, unknown>): void { this.log('info', message, meta); }
  warn(message: string, meta?: Record<string, unknown>): void { this.log('warn', message, meta); }
  error(message: string, meta?: Record<string, unknown>): void { this.log('error', message, meta); }

  child(tags: Record<string, unknown>): typeof this {
    const child = new LoggerPlugin();
    child.minLevel = this.minLevel;
    child.format = this.format;
    child.tags = { ...this.tags, ...tags };
    child.startTime = this.startTime;
    return child as typeof this;
  }
}

export default function createPlugin(_logger: unknown): ForgePlugin {
  return new LoggerPlugin();
}
```

---

## Section 6: api-gateway-plugin

### 6.1 `packages/api-gateway-plugin/package.json`

```json
{
  "name": "@forge/api-gateway-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": "./dist/index.js" },
  "dependencies": { "@forge/spec": "workspace:*" },
  "scripts": { "build": "tsc --project tsconfig.json" }
}
```

### 6.2 `packages/api-gateway-plugin/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"],
  "references": [{ "path": "../forge-spec" }]
}
```

### 6.3 `packages/api-gateway-plugin/plugin.yaml`

```yaml
name: @forge/api-gateway-plugin
version: 0.1.0
description: Unified HTTP entry point. Routes requests to registered plugin handlers.
forgeVersion: ">=0.1.0"
dependencies:
  - @forge/config-plugin
  - @forge/logger-plugin
provides:
  - http-server
events:
  - http:request
  - http:response
entry: ./dist/index.js
```

### 6.4 `packages/api-gateway-plugin/src/impl.ts`

**Implements:** `ForgePlugin`.

**Dependencies:** Declares `@forge/config-plugin` and `@forge/logger-plugin` as required.

**State:**
- `Map<string, { route: RouteDefinition, handler: RouteHandler }>` — registered routes

**init:** Reads `ctx.config.get('http.port', 3000)` and `ctx.config.get('http.host', '0.0.0.0')`. Registers all routes defined in other plugins via `routes` property on each plugin in the app.

**start:** Starts the built-in Node.js HTTP server. Parses incoming requests, matches against registered routes, calls the handler, and returns JSON response `{ data, statusCode }`.

**Routes matching:**
- Exact path match first, then parametric (e.g. `/config/:key` matches `/config/timeout` with `params = { key: 'timeout' }`)
- Query string parsed into `query` object
- Request body parsed as JSON if `Content-Type: application/json`
- 404 if no route matches; 405 if method not allowed

**HTTP response format:**
```json
{ "data": <result>, "statusCode": 200 }
```
Errors serialized as:
```json
{ "error": { "code": "FORGE012", "message": "..." }, "statusCode": 404 }
```

**routes:** Exposes its own routes:
- `GET /health` — returns aggregate health status of all registered plugins
- `GET /routes` — returns list of all registered routes

**healthCheck:** Returns `HealthStatus { status: 'healthy', plugin: '@forge/api-gateway-plugin', ... }`.

### 6.5 `packages/api-gateway-plugin/src/PluginSpec.ts`

```typescript
import type { PluginSpec } from '@forge/spec';

export const apiGatewayPluginSpec: PluginSpec = {
  tier: 'core',
  api: [
    {
      name: 'http.registerRoute',
      description: 'Register an HTTP route that dispatches to a plugin handler.',
      parameters: [
        { name: 'route', type: 'RouteDefinition', required: true, description: 'Route definition (method, path, handler name)' },
        { name: 'handler', type: 'RouteHandler', required: true, description: 'Async function(req, params) => unknown' },
      ],
      returns: 'void',
    },
    {
      name: 'http.start',
      description: 'Start the HTTP server on the configured port.',
      returns: 'Promise<void>',
    },
    {
      name: 'http.stop',
      description: 'Stop the HTTP server.',
      returns: 'Promise<void>',
    },
  ],
  dataModels: [],
  events: [
    {
      name: 'http:request',
      description: 'Emitted on the plugin bus for every incoming HTTP request.',
      payloadType: '{ method: string; path: string; plugin?: string }',
    },
    {
      name: 'http:response',
      description: 'Emitted after every HTTP response is sent.',
      payloadType: '{ method: string; path: string; statusCode: number; duration_ms: number }',
    },
  ],
  dependencies: [
    {
      plugin: '@forge/config-plugin',
      type: 'required',
      integration: 'Access server.port and server.host via ctx.config.get()',
      example: `const port = ctx.config.get<number>('server.port', 3000);`,
    },
    {
      plugin: '@forge/logger-plugin',
      type: 'required',
      integration: 'Log all HTTP requests and errors via ctx.logger',
      example: `ctx.logger.info('HTTP request', { method, path, statusCode });`,
    },
  ],
  usageExamples: [
    {
      title: 'Register a plugin route',
      description: 'Register an HTTP endpoint during plugin init.',
      code: `export class MyPlugin implements ForgePlugin {
  routes: RouteDefinition[] = [
    { method: 'GET', path: '/hello', handler: 'getHello', description: 'Say hello' },
  ];

  async init(ctx: PluginContext) {
    const http = ctx.config.get('@forge/api-gateway-plugin');
    // Route registration happens via the plugin.routes property automatically
  }
}`,
    },
    {
      title: 'Read health endpoint',
      description: 'Query the aggregate health of all running plugins.',
      code: `// GET /health
// Response:
{
  "status": "healthy",
  "plugins": [
    { "plugin": "@forge/config-plugin", "status": "healthy", "uptime": 120 },
    { "plugin": "@forge/logger-plugin", "status": "healthy", "uptime": 120 }
  ]
}`,
    },
  ],
};
```

### 6.6 `packages/api-gateway-plugin/src/index.ts`

```typescript
import type {
  ForgePlugin, PluginContext, HealthStatus,
  RouteDefinition, RouteHandler, HttpServerAPI,
} from '@forge/spec';
import { apiGatewayPluginSpec } from './PluginSpec.js';

export class ApiGatewayPlugin implements ForgePlugin {
  readonly name = '@forge/api-gateway-plugin';
  readonly version = '0.1.0';
  readonly description = 'Unified HTTP entry point for ForgeKit';
  readonly dependencies = ['@forge/config-plugin', '@forge/logger-plugin'];
  readonly provides: string[] = ['http-server'];
  readonly events: string[] = ['http:request', 'http:response'];
  readonly spec = apiGatewayPluginSpec;

  private routes = new Map<string, { route: RouteDefinition; handler: RouteHandler }>();
  private server: import('http').Server | null = null;
  private port = 3000;
  private host = '0.0.0.0';
  private ctx!: PluginContext;
  private startTime = 0;

  async init(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
    this.port = ctx.config.get<number>('server.port') ?? 3000;
    this.host = ctx.config.get<string>('server.host') ?? '0.0.0.0';
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    await this.startServer();
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((res) => this.server!.close(() => res()));
      this.server = null;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      plugin: this.name,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  // Called by app bootstrap to register routes from all plugins
  registerRoute(route: RouteDefinition, handler: RouteHandler): void {
    const key = `${route.method} ${route.path}`;
    this.routes.set(key, { route, handler });
  }

  private async startServer(): Promise<void> {
    const http = await import('http');

    this.server = http.createServer(async (req, res) => {
      const start = Date.now();
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const method = (req.method ?? 'GET').toUpperCase() as RouteDefinition['method'];
      const path = url.pathname;

      this.ctx.bus.emit('http:request', { method, path });

      // Build context
      const params: Record<string, string> = {};
      const query: Record<string, string> = Object.fromEntries(url.searchParams);
      let body: unknown = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const raw = await new Promise<string>((res, rej) => {
          let d = '';
          req.on('data', (c) => (d += c));
          req.on('end', () => res(d));
          req.on('error', rej);
        });
        try { body = JSON.parse(raw); } catch { body = raw; }
      }

      // Find route
      const key = `${method} ${path}`;
      let routeData = this.routes.get(key);
      if (!routeData) {
        // Try parametric: /config/:key
        for (const [k, v] of this.routes) {
          const [m, p] = k.split(' ');
          if (m !== method) continue;
          const paramNames = [...p.matchAll(/:([^/]+)/g)].map(([, n]) => n);
          const regex = new RegExp(`^${p.replace(/:[^/]+/g, '([^/]+)')}$`);
          const match = path.match(regex);
          if (match) {
            for (let i = 0; i < paramNames.length; i++) params[paramNames[i]] = match[i + 1];
            routeData = v;
            break;
          }
        }
      }

      let statusCode = 200;
      let responseData: unknown;

      if (!routeData) {
        statusCode = 404;
        responseData = { error: { code: 'FORGE011', message: `Route ${method} ${path} not found` }, statusCode: 404 };
      } else {
        try {
          responseData = await routeData.handler(params, body, query);
        } catch (e) {
          statusCode = 500;
          responseData = { error: { code: 'FORGE001', message: String(e) }, statusCode: 500 };
        }
      }

      // /health and /routes built-in
      if (method === 'GET' && path === '/health') {
        responseData = { status: 'healthy', port: this.port, uptime: Date.now() - this.startTime };
      }
      if (method === 'GET' && path === '/routes') {
        responseData = { routes: [...this.routes.keys()] };
      }

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = statusCode;
      res.end(JSON.stringify({ data: responseData, statusCode }));

      this.ctx.bus.emit('http:response', {
        method, path, statusCode, duration_ms: Date.now() - start,
      });
    });

    await new Promise<void>((res) => this.server!.listen(this.port, this.host, () => {
      this.ctx.logger.info(`API Gateway listening on ${this.host}:${this.port}`);
      res();
    }));
  }
}

export default function createPlugin(_logger: unknown): ForgePlugin {
  return new ApiGatewayPlugin();
}
```

---

## Section 7: minimal-app Example

### 7.1 `examples/minimal-app/forge.json`

```json
{
  "name": "minimal-app",
  "version": "0.1.0",
  "forgeVersion": ">=0.1.0",
  "plugins": [
    { "name": "@forge/config-plugin", "source": "../../packages/config-plugin", "enabled": true },
    { "name": "@forge/logger-plugin", "source": "../../packages/logger-plugin", "enabled": true },
    { "name": "@forge/api-gateway-plugin", "source": "../../packages/api-gateway-plugin", "enabled": true }
  ],
  "globalConfig": {
    "log.level": "info",
    "log.format": "text",
    "server.port": 3000,
    "server.host": "0.0.0.0"
  }
}
```

### 7.2 `examples/minimal-app/package.json`

```json
{
  "name": "minimal-app",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "dependencies": {
    "@forge/spec": "workspace:*",
    "@forge/core": "workspace:*",
    "@forge/config-plugin": "workspace:*",
    "@forge/logger-plugin": "workspace:*",
    "@forge/api-gateway-plugin": "workspace:*"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "start": "node --loader ts-node/esm src/index.ts",
    "start:compiled": "node dist/index.js"
  }
}
```

### 7.3 `examples/minimal-app/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../packages/forge-spec" },
    { "path": "../../packages/forge-core" },
    { "path": "../../packages/config-plugin" },
    { "path": "../../packages/logger-plugin" },
    { "path": "../../packages/api-gateway-plugin" }
  ]
}
```

### 7.4 `examples/minimal-app/src/App.ts`

Bootstraps forge-core with all 3 plugins.

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PluginBus } from '@forge/core';
import { createPluginContext } from '@forge/core';
import { ConfigPlugin } from '@forge/config-plugin';
import { LoggerPlugin } from '@forge/logger-plugin';
import { ApiGatewayPlugin } from '@forge/api-gateway-plugin';
import type { ForgePlugin, PluginContext } from '@forge/spec';

export interface ForgeJson {
  name: string;
  plugins: { name: string; source: string; enabled: boolean }[];
  globalConfig: Record<string, unknown>;
}

export async function buildApp(forgeJsonPath: string) {
  // 1. Load forge.json
  const forgeJson: ForgeJson = JSON.parse(readFileSync(forgeJsonPath, 'utf-8'));

  // 2. Instantiate core plugins (hardcoded for Phase 1)
  //   In Phase 2+, this will be dynamic via PluginLoader + PluginRegistry
  const configPlugin = new ConfigPlugin(forgeJson.globalConfig);
  const loggerPlugin = new LoggerPlugin();
  const apiGatewayPlugin = new ApiGatewayPlugin();

  // 3. Wire plugin context (config gets logger; all three get bus)
  const bus = new PluginBus();

  // Config needs logger to emit startup logs
  const configCtx: PluginContext = {
    config: configPlugin as unknown as import('@forge/spec').ConfigPluginAPI,
    logger: loggerPlugin as unknown as import('@forge/spec').LoggerPluginAPI,
    bus: bus as unknown as import('@forge/spec').PluginBusAPI,
  };

  const allPlugins: ForgePlugin[] = [configPlugin, loggerPlugin, apiGatewayPlugin];

  const ctx: PluginContext = {
    config: configPlugin as unknown as import('@forge/spec').ConfigPluginAPI,
    logger: loggerPlugin as unknown as import('@forge/spec').LoggerPluginAPI,
    bus: bus as unknown as import('@forge/spec').PluginBusAPI,
  };

  // 4. Register routes from api-gateway's built-in routes
  //   (Other plugins' routes would be registered here in future phases)

  // 5. Init in order: config → logger → api-gateway
  for (const plugin of allPlugins) {
    await plugin.init(ctx);
  }

  // 6. Start in order: config → logger → api-gateway
  for (const plugin of allPlugins) {
    await plugin.start();
  }

  loggerPlugin.info('ForgeKit app started', { app: forgeJson.name, plugins: allPlugins.map(p => p.name) });
  bus.emit('forge:ready', { app: forgeJson.name });

  return {
    bus,
    ctx,
    plugins: allPlugins,
    async stop() {
      bus.emit('forge:stopping', {});
      // Stop in reverse order
      for (const plugin of [...allPlugins].reverse()) {
        await plugin.stop();
      }
      bus.emit('forge:stopped', {});
    },
  };
}
```

### 7.5 `examples/minimal-app/src/index.ts`

Entry point that starts the app and handles shutdown signals.

```typescript
import { buildApp } from './App.js';

const app = await buildApp(resolve(import.meta.dirname, '../forge.json'));

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await app.stop();
  process.exit(0);
});
```

---

## Section 8: Tests

Each package includes its own tests. The following test files must be created:

### 8.1 `packages/forge-core/src/plugin-bus.test.ts`

```typescript
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
```

### 8.2 `packages/forge-core/src/plugin-lifecycle.test.ts`

Test init/start/stop sequence, including error propagation and reverse-order stop.

### 8.3 `packages/config-plugin/src/index.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
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

  it('should return all config as object', () => {
    const plugin = new ConfigPlugin({ a: 1, b: 2 });
    expect(plugin.getAll()).toEqual({ a: 1, b: 2 });
  });
});
```

### 8.4 `packages/logger-plugin/src/index.test.ts`

Test that `shouldLog` respects level threshold, that `child()` merges tags, and that invalid levels do not throw.

---

## File Checklist

| File | Status |
|------|--------|
| `pnpm-workspace.yaml` | CREATE |
| `package.json` (root) | CREATE |
| `tsconfig.base.json` | CREATE |
| `vitest.config.ts` | CREATE |
| `packages/forge-spec/package.json` | CREATE |
| `packages/forge-spec/tsconfig.json` | CREATE |
| `packages/forge-spec/src/index.ts` | CREATE |
| `packages/forge-spec/src/api-contract.ts` | CREATE |
| `packages/forge-spec/src/plugin-spec.ts` | CREATE |
| `packages/forge-spec/src/plugin-yaml-schema.json` | CREATE |
| `packages/forge-spec/src/errors.ts` | CREATE |
| `packages/forge-spec/src/events.ts` | CREATE |
| `packages/forge-core/package.json` | CREATE |
| `packages/forge-core/tsconfig.json` | CREATE |
| `packages/forge-core/src/index.ts` | CREATE |
| `packages/forge-core/src/plugin-bus.ts` | CREATE |
| `packages/forge-core/src/plugin-bus.test.ts` | CREATE |
| `packages/forge-core/src/plugin-context.ts` | CREATE |
| `packages/forge-core/src/plugin-registry.ts` | CREATE |
| `packages/forge-core/src/plugin-lifecycle.ts` | CREATE |
| `packages/forge-core/src/plugin-lifecycle.test.ts` | CREATE |
| `packages/forge-core/src/plugin-loader.ts` | CREATE |
| `packages/config-plugin/package.json` | CREATE |
| `packages/config-plugin/tsconfig.json` | CREATE |
| `packages/config-plugin/plugin.yaml` | CREATE |
| `packages/config-plugin/src/index.ts` | CREATE |
| `packages/config-plugin/src/PluginSpec.ts` | CREATE |
| `packages/config-plugin/src/index.test.ts` | CREATE |
| `packages/logger-plugin/package.json` | CREATE |
| `packages/logger-plugin/tsconfig.json` | CREATE |
| `packages/logger-plugin/plugin.yaml` | CREATE |
| `packages/logger-plugin/src/index.ts` | CREATE |
| `packages/logger-plugin/src/PluginSpec.ts` | CREATE |
| `packages/logger-plugin/src/index.test.ts` | CREATE |
| `packages/api-gateway-plugin/package.json` | CREATE |
| `packages/api-gateway-plugin/tsconfig.json` | CREATE |
| `packages/api-gateway-plugin/plugin.yaml` | CREATE |
| `packages/api-gateway-plugin/src/index.ts` | CREATE |
| `packages/api-gateway-plugin/src/PluginSpec.ts` | CREATE |
| `examples/minimal-app/package.json` | CREATE |
| `examples/minimal-app/tsconfig.json` | CREATE |
| `examples/minimal-app/forge.json` | CREATE |
| `examples/minimal-app/src/App.ts` | CREATE |
| `examples/minimal-app/src/index.ts` | CREATE |

---

## Build Order

1. `packages/forge-spec` — types, errors, events (no dependencies)
2. `packages/forge-core` — runtime (depends on forge-spec)
3. `packages/config-plugin` — (depends on forge-spec)
4. `packages/logger-plugin` — (depends on forge-spec)
5. `packages/api-gateway-plugin` — (depends on forge-spec)
6. `examples/minimal-app` — (depends on all above)

---

## Acceptance Criteria

- `pnpm install` installs all workspace packages without errors
- `pnpm -r run build` compiles all packages to `dist/` without TypeScript errors
- `pnpm test` runs all vitest tests and all pass
- `node examples/minimal-app/dist/index.js` starts the HTTP server on port 3000
- `GET http://localhost:3000/health` returns a JSON health response
- `GET http://localhost:3000/routes` returns a list of registered routes
- `GET http://localhost:3000/nonexistent` returns 404 with `{ error: { code: 'FORGE011', ... } }`
- Stopping the process (SIGINT) cleanly calls `stop()` on all plugins in reverse order
- All plugin exports expose `name`, `version`, `description`, `spec` properties
- `PluginSpec.ts` for each plugin contains at least 1 usage example
