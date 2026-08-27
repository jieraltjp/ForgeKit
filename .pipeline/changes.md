# Changes Summary — ForgeKit Phase 1 Implementation

## All 47 files created

### Root level (5 files)
- `pnpm-workspace.yaml` — pnpm workspaces definition (packages/*, examples/*)
- `package.json` — root monorepo config with build/test scripts and devDeps
- `tsconfig.base.json` — shared TypeScript config (ES2022, NodeNext, strict)
- `vitest.config.ts` — shared vitest config (node environment, globals: true)
- `.gitignore` — standard Node.js ignores (node_modules, dist, .env, etc.)

### packages/forge-spec/ (8 files)
- `package.json` — @forge/spec package, build/pretest scripts
- `tsconfig.json` — extends tsconfig.base.json
- `src/index.ts` — barrel export re-exporting all spec modules
- `src/api-contract.ts` — ForgePlugin, PluginContext, ConfigPluginAPI, LoggerPluginAPI, PluginBusAPI, RouteDefinition, HealthStatus, RouteHandler, etc.
- `src/plugin-spec.ts` — PluginSpec, APIDefinition, DataModel, EventDefinition, DependencyDefinition, UsageExample interfaces
- `src/plugin-yaml-schema.json` — JSON Schema for plugin.yaml validation (name, version, description, entry required; kebab-case pattern for name)
- `src/errors.ts` — ForgeErrors const (FORGE001–FORGE013), ForgeError class
- `src/events.ts` — CoreEvents const (forge:init/ready/stopping/stopped, plugin:init/started/stopped/error), PluginLifecyclePayload interface

### packages/forge-core/ (10 files)
- `package.json` — @forge/core, depends on @forge/spec
- `tsconfig.json` — extends tsconfig.base.json, references forge-spec
- `src/index.ts` — barrel export (PluginBus, PluginRegistry, PluginLoader, PluginLifecycle, createPluginContext)
- `src/plugin-bus.ts` — in-memory pub/sub event bus (emit/on/once/off with Map<string, Set<EventHandler>>)
- `src/plugin-bus.test.ts` — 5 tests: emit, unsubscribe, once, no-op emit, no-op off
- `src/plugin-context.ts` — createPluginContext factory function
- `src/plugin-registry.ts` — reads plugin.yaml manifests, topological sort with cycle detection (PLUGIN_DEP_CYCLE), dependency validation (PLUGIN_DEP_MISSING)
- `src/plugin-loader.ts` — dynamic import of plugin entry files, calls createPlugin factory, wraps errors as ForgeError
- `src/plugin-lifecycle.ts` — manages init/start/stop in order, reverse-order stop, parallel health checks, emits plugin:init/started/stopped/error events, registers SIGINT/SIGTERM handlers
- `src/plugin-lifecycle.test.ts` — 6 tests: init/start/stop order, reverse stop, duplicate init throw, error event emit, parallel health checks

### packages/config-plugin/ (6 files)
- `package.json` — @forge/config-plugin, depends on @forge/spec
- `tsconfig.json` — extends tsconfig.base.json, references forge-spec
- `plugin.yaml` — manifest (name, version, description, provides: config, events: config:updated)
- `src/PluginSpec.ts` — configPluginSpec with api definitions (get/set/has/getAll/onUpdate), 2 usage examples
- `src/index.ts` — ConfigPlugin class (Map config store, watchers Set, FORGE_ env var override), default export createPlugin factory
- `src/index.test.ts` — 5 tests: undefined key, fallback, set/get, watcher notification, getAll

### packages/logger-plugin/ (6 files)
- `package.json` — @forge/logger-plugin, depends on @forge/spec
- `tsconfig.json` — extends tsconfig.base.json, references forge-spec
- `plugin.yaml` — manifest (provides: logger)
- `src/PluginSpec.ts` — loggerPluginSpec with debug/info/warn/error/child API definitions, 2 usage examples
- `src/index.ts` — LoggerPlugin class (LEVEL_ORDER, json/text output, child() with tag merging), default export createPlugin factory
- `src/index.test.ts` — 4 tests: default logging, threshold filtering, child tag merging, invalid level init

### packages/api-gateway-plugin/ (5 files)
- `package.json` — @forge/api-gateway-plugin, depends on @forge/spec
- `tsconfig.json` — extends tsconfig.base.json, references forge-spec
- `plugin.yaml` — manifest (depends on config-plugin and logger-plugin, provides: http-server, events: http:request/http:response)
- `src/PluginSpec.ts` — apiGatewayPluginSpec with http.registerRoute/start/stop API, 2 dependencies, 2 usage examples
- `src/index.ts` — ApiGatewayPlugin class (HTTP server with parametric route matching, /health and /routes built-in endpoints, http:request/http:response bus events, registerRoute method), default export createPlugin factory

### examples/minimal-app/ (5 files)
- `package.json` — minimal-app, depends on all 5 workspace packages
- `tsconfig.json` — extends tsconfig.base.json, references all 5 packages
- `forge.json` — manifest listing 3 plugins (config-plugin, logger-plugin, api-gateway-plugin) with sources and globalConfig
- `src/App.ts` — buildApp() that instantiates 3 plugins, wires PluginContext, calls init/start, returns app handle with stop()
- `src/index.ts` — entry point that calls buildApp(), registers SIGINT/SIGTERM shutdown handlers

## Key implementation details
- All imports use `.js` extensions (ES module NodeNext compliance)
- Test files import `vi` from 'vitest' and use `globals: true` in vitest config
- plugin-yaml-schema.json uses JSON Schema draft-07 format with kebab-case name pattern
- PluginLoader wraps all import errors in ForgeError(PLUGIN_LOAD_FAILED, cause=originalError)
- PluginRegistry uses a minimal YAML parser (no external yaml library dependency)
- LoggerPlugin.child() returns a new LoggerPlugin instance with merged tags (not a Proxy)
- ApiGatewayPlugin handles both exact and parametric route matching (/config/:key)
- All PluginSpec objects include at least 2 usage examples with code blocks
