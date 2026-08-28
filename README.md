# ForgeKit

An AI-native, plugin-based TypeScript framework for building extensible applications.

**Version:** 0.2.0

---

## Phase 2: Developer Experience (v0.2.0)

- **forge-cli**: `forge new plugin`, `forge check`, `forge generate`, `forge list`, `forge run`
- **Dynamic loading**: Load plugins from `forge.json` — workspace paths or npm packages
- **@forge/db-plugin**: Unified DB abstraction (SQLite, PostgreSQL, MongoDB)
- **@forge/auth-plugin**: JWT authentication with middleware guard
- **@forge/events-plugin**: In-memory + Redis pub/sub event bus
- **@forge/spec-generator**: Auto-generate `PluginSpec.ts` from TypeScript source
- **Hot reload**: Watch plugin source files and reload on change
- **blog-app**: Full example application with auth, users, posts

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the blog example
cd examples/blog-app && pnpm migrate && pnpm start

# Scaffold a new plugin
pnpm forge new plugin my-plugin

# Check a plugin's spec compliance
pnpm forge check --plugin my-plugin

# Auto-generate PluginSpec from source
node packages/plugin-spec-generator/dist/index.js packages/my-plugin
```

## Architecture

ForgeKit is built on a plugin-first architecture. Every capability is a plugin:

- `@forge/core` — plugin bus, registry, lifecycle management
- `@forge/config-plugin` — configuration management
- `@forge/logger-plugin` — structured logging
- `@forge/api-gateway-plugin` — HTTP routing
- `@forge/db-plugin` — database abstraction
- `@forge/auth-plugin` — JWT authentication
- `@forge/events-plugin` — distributed event bus

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.
