# ForgeKit

**The plugin skeleton system that makes AI-generated code composable, discoverable, and collaborative.**

ForgeKit is an open-source framework inspired by Spring Cloud's architecture — but designed from the ground up for **AI-native software development**. Every plugin has a machine-readable `PluginSpec` that any AI agent can read in seconds to understand what it does, how to extend it, and how to integrate with it.

> If Spring Cloud solves microservices structure for teams, ForgeKit solves plugin structure for AI agents.

---

## The Problem

AI code generation fails at scale not because AI can't write code — but because:

- **No contracts** — plugins lack standardized interfaces, breaking integration
- **No discoverability** — new AI agents can't understand a codebase without extensive human briefing
- **No coordination** — multiple AIs working simultaneously create conflicts
- **No quality gates** — no standardized testing or documentation per plugin

## The Solution

```
┌─────────────────────────────────────────────────────────────┐
│                        ForgeKit App                         │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐    │
│  │  Config  │  │  Logger  │  │    API Gateway        │    │
│  │  Plugin  │  │  Plugin  │  │    Plugin             │    │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘    │
│       │              │                     │                │
│       └──────────────┼─────────────────────┘                │
│                      │                                       │
│              ┌───────┴───────┐                              │
│              │  Plugin Bus   │  ← Pub/Sub Event Channel    │
│              └───────────────┘                              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  + more...      │
│  │   Auth   │  │   Data    │  │  Events  │                  │
│  │  Plugin  │  │  Plugin   │  │  Plugin  │  ← Your plugins  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

Each plugin reads its own `PluginSpec.ts` → AI knows everything it needs to generate code for that plugin.

---

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/jieraltjp/ForgeKit.git
cd ForgeKit
pnpm install

# 2. Build all packages
pnpm build

# 3. Start the minimal app
node examples/minimal-app/dist/index.js
# → API Gateway listening on 0.0.0.0:3000
```

Try the endpoints:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/routes
```

---

## Run Tests

```bash
pnpm test        # all tests
pnpm test:watch   # watch mode
```

---

## Project Structure

```
forgekit/
├── packages/
│   ├── forge-spec/           # Shared interfaces, error codes, PluginSpec schema
│   ├── forge-core/           # Runtime: PluginBus, Registry, Loader, Lifecycle
│   ├── config-plugin/        # Centralized config (FORGE_* env override)
│   ├── logger-plugin/        # Structured JSON/text logging
│   └── api-gateway-plugin/   # HTTP server with route matching
└── examples/
    └── minimal-app/          # Composed application using all plugins
```

---

## Core Plugins

| Plugin | Package | Purpose |
|---|---|---|
| Config | `@forge/config-plugin` | Key-value config with env override and change watchers |
| Logger | `@forge/logger-plugin` | Structured logging with per-plugin tagging |
| API Gateway | `@forge/api-gateway-plugin` | HTTP server, route matching, `/health`, `/routes` |

---

## Writing Your First Plugin

### Step 1: Create the plugin directory

```
packages/my-plugin/
├── package.json
├── tsconfig.json
├── plugin.yaml          ← Plugin manifest
└── src/
    ├── index.ts         ← Plugin entry (ForgePlugin implementation)
    └── PluginSpec.ts    ← Machine-readable self-documentation
```

### Step 2: Define the manifest (`plugin.yaml`)

```yaml
name: my-plugin
version: 0.1.0
description: What this plugin does
forgeVersion: ">=0.1.0"
dependencies: []
provides:
  - my-capability
events:
  - my-plugin:event
entry: ./dist/index.js
```

### Step 3: Implement the plugin (`src/index.ts`)

```typescript
import type { ForgePlugin, PluginContext, HealthStatus } from '@forge/spec';

export class MyPlugin implements ForgePlugin {
  readonly name = 'my-plugin';
  readonly version = '0.1.0';
  readonly description = 'What this plugin does';
  readonly dependencies: string[] = [];
  readonly provides: string[] = ['my-capability'];
  readonly events: string[] = ['my-plugin:event'];
  readonly spec = myPluginSpec;

  async init(ctx: PluginContext): Promise<void> {
    ctx.logger.info('my-plugin initialized');
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', plugin: this.name, version: this.version, uptime: 0 };
  }
}

export default function createPlugin(): ForgePlugin {
  return new MyPlugin();
}
```

### Step 4: Document with PluginSpec (`src/PluginSpec.ts`)

```typescript
import type { PluginSpec } from '@forge/spec';

export const myPluginSpec: PluginSpec = {
  tier: 'extension',
  api: [
    {
      name: 'my-plugin.doSomething',
      description: 'Does something useful.',
      parameters: [
        { name: 'input', type: 'string', required: true, description: 'The input string' },
      ],
      returns: 'string — the result',
      example: `ctx.config.get('my-plugin.option');`,
    },
  ],
  dataModels: [],
  events: [
    {
      name: 'my-plugin:event',
      description: 'Emitted when something happens.',
      payloadType: '{ value: string }',
    },
  ],
  dependencies: [],
  usageExamples: [
    {
      title: 'Basic usage',
      description: 'How to use this plugin.',
      code: `const result = await ctx.config.get('my-plugin.setting');`,
    },
  ],
};
```

An AI reading `PluginSpec.ts` knows exactly what this plugin does — without reading any implementation code.

---

## Key Design Principles

### 1. Spec-First
Every plugin ships with a `PluginSpec.ts`. AIs read specs, not source code.

### 2. Plugin Bus
Plugins communicate via an event bus, not direct imports. AIs working on different plugins don't break each other.

### 3. Standard Contracts
`@forge/spec` defines the `ForgePlugin` interface, standard error codes, and event types — shared across all plugins.

### 4. Environment-Aware Config
The config plugin reads `FORGE_*` environment variables at startup. Configuration is explicit, auditable, and 12-factor.

---

## Documentation

| Doc | What it covers |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Deep dive into plugin lifecycle, bus, context injection |
| [PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md) | Complete plugin authoring guide |
| [AI_AGENT_GUIDE.md](docs/AI_AGENT_GUIDE.md) | How AI agents use ForgeKit to collaborate |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute to ForgeKit |

---

## License

MIT © jieraltjp

---

<p align="center">
  <strong>ForgeKit</strong> — The skeleton that lets AI build real systems together.
</p>
