# ForgeKit — Specification

**Version:** 0.2.0
**Status:** Phase 2 Complete

---

## Implementation Status

### Phase 1 Complete (v0.1.0)

**Core:**
- `@forge/spec` — `ForgePlugin` interface, `PluginSpec` type, `PluginContext`, `ForgeError`
- `@forge/core` — `PluginBus` (in-memory pub/sub), `PluginRegistry`, `PluginLoader`, `PluginLifecycle`
- `@forge/config-plugin` — flat key-value store with env-var override, `PluginSpec` docs
- `@forge/logger-plugin` — structured JSON logger with child loggers, log levels
- `@forge/api-gateway-plugin` — HTTP routing, parametric routes, health endpoint

**Examples:**
- `examples/minimal-app/` — minimal app with config, logger, API gateway

---

### Phase 2 Complete (v0.2.0)

**Code:**
- `packages/forge-cli/` — full command suite: `new plugin`, `check`, `generate`, `list`, `run`
- `packages/forge-core/src/plugin-loader.ts` — `loadPluginFromPath`, `loadAllFromForgeJson`, workspace + npm path resolution
- `packages/plugin-spec-generator/` — ts-morph AST parsing to generate `PluginSpec.generated.ts`
- `packages/db-plugin/` — `DbAdapter` interface + `SqliteAdapter` (better-sqlite3) + `MongoAdapter` (mongodb)
- `packages/auth-plugin/` — JWT sign/verify/middleware + bcrypt password hashing
- `packages/events-plugin/` — in-memory PluginBus + Redis pub/sub adapter
- `examples/blog-app/` — full blog app with users, posts, auth, JWT, DB
- `examples/minimal-app/src/hot-reload.ts` — chokidar-based plugin hot reload
- **All packages: complete PluginSpec.ts, plugin.yaml, test coverage (3+ tests each)**

**New CLI Commands:**
- `forge new plugin <name>` — scaffold full plugin with package.json, tsconfig.json, PluginSpec.ts, index.ts, test
- `forge check --plugin <name>` — validate plugin.yaml + PluginSpec.ts, output JSON/text report
- `forge generate <plugin> <component>` — create `src/handlers/<component>.ts` RouteHandler stub
- `forge list` — read forge.json and print plugin table
- `forge run` — execute app dist/index.js

**Updated Documentation:**
- `docs/ARCHITECTURE.md` — Phase 2 additions (CLI, db, auth, events plugins)
- `docs/PLUGIN_SPEC.md` — Phase 2 plugin authoring guide
- `docs/AI_AGENT_GUIDE.md` — updated for all Phase 2 plugins
