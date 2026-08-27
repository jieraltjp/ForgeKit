# Plugin Authoring Guide

A complete guide to writing a ForgeKit plugin — from idea to published package.

---

## What Makes a ForgeKit Plugin

A ForgeKit plugin is a TypeScript package that:

1. **Implements `ForgePlugin`** — the standard interface
2. **Ships with `PluginSpec.ts`** — machine-readable self-documentation
3. **Has a `plugin.yaml`** — manifest for the registry
4. **Exports `createPlugin`** — the factory function for dynamic loading

---

## Step 1: Set Up the Package

```
packages/my-plugin/
├── package.json
├── tsconfig.json
├── plugin.yaml
└── src/
    ├── index.ts         ← Factory + implementation
    └── PluginSpec.ts    ← Self-documentation
```

### `package.json`

```json
{
  "name": "@forge/my-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": "./dist/index.js" },
  "dependencies": {
    "@forge/spec": "workspace:*"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json"
  }
}
```

### `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"],
  "references": [{ "path": "../forge-spec" }]
}
```

---

## Step 2: Write the Manifest (`plugin.yaml`)

```yaml
name: @forge/my-plugin          # Must be unique across the ecosystem
version: 0.1.0
description: What this plugin does in one clear sentence
forgeVersion: ">=0.1.0"
dependencies:                    # Other plugins this one requires
  - @forge/config-plugin
provides:                        # Capabilities this plugin offers
  - my-capability
events:                          # Custom events this plugin emits
  - my-plugin:something-happened
entry: ./dist/index.js           # Relative path to compiled entry
```

### Manifest fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Kebab-case, scoped (`@forge/`) for official plugins |
| `version` | Yes | Semver |
| `description` | Yes | One clear sentence |
| `forgeVersion` | No | ForgeKit version range required |
| `dependencies` | No | Other plugin names this depends on |
| `provides` | No | Capability names exported by this plugin |
| `events` | No | Custom event names this plugin emits |
| `entry` | Yes | Path to compiled JS entry relative to package root |

---

## Step 3: Implement `ForgePlugin`

```typescript
import type { ForgePlugin, PluginContext, HealthStatus } from '@forge/spec';
import { myPluginSpec } from './PluginSpec.js';

export class MyPlugin implements ForgePlugin {
  readonly name = '@forge/my-plugin';
  readonly version = '0.1.0';
  readonly description = 'What this plugin does';
  readonly dependencies: string[] = ['@forge/config-plugin'];
  readonly provides: string[] = ['my-capability'];
  readonly events: string[] = ['my-plugin:something-happened'];
  readonly spec = myPluginSpec;

  async init(ctx: PluginContext): Promise<void> {
    // Read config
    const setting = ctx.config.get<string>('my-plugin.setting', 'default');
    ctx.logger.info('my-plugin initialized', { setting });

    // Subscribe to events from other plugins
    ctx.bus.on('config:updated', (payload: unknown) => {
      const { key, value } = payload as { key: string; value: unknown };
      if (key === 'my-plugin.setting') {
        ctx.logger.info('Setting changed', { value });
      }
    });
  }

  async start(): Promise<void> {
    // Start background workers, open connections
  }

  async stop(): Promise<void> {
    // Release resources: close DB connections, stop timers
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      plugin: this.name,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

// Required: factory function for dynamic loading
export default function createPlugin(): ForgePlugin {
  return new MyPlugin();
}
```

---

## Step 4: Write `PluginSpec.ts`

The `PluginSpec` is the most important file in your plugin. An AI agent reads this to understand everything your plugin does — no need to read source code.

```typescript
import type { PluginSpec } from '@forge/spec';

export const myPluginSpec: PluginSpec = {
  tier: 'extension',          // 'core' | 'extension' | 'community'
  api: [
    {
      name: 'my-plugin.doAction',
      description: 'Performs the primary action this plugin was built for.',
      parameters: [
        {
          name: 'input',
          type: 'string',
          required: true,
          description: 'The input string to process',
        },
        {
          name: 'options',
          type: 'MyOptions',
          required: false,
          description: 'Optional configuration',
        },
      ],
      returns: 'Promise<string> — the processed result',
      example: `const result = await ctx.config.get('my-plugin.option');`,
    },
  ],
  dataModels: [
    {
      name: 'MyOptions',
      description: 'Configuration options for the action.',
      fields: [
        { name: 'timeout', type: 'number', description: 'Timeout in milliseconds' },
        { name: 'retries', type: 'number', description: 'Number of retry attempts' },
      ],
    },
  ],
  events: [
    {
      name: 'my-plugin:action-completed',
      description: 'Emitted when an action finishes.',
      payloadType: '{ input: string; result: string; duration_ms: number }',
    },
  ],
  dependencies: [
    {
      plugin: '@forge/config-plugin',
      type: 'required',
      integration: 'Read settings at init via ctx.config.get()',
      example: `const timeout = ctx.config.get<number>('my-plugin.timeout', 5000);`,
    },
  ],
  usageExamples: [
    {
      title: 'Read configuration at startup',
      description: 'Use init() to read all required settings.',
      code: `async init(ctx: PluginContext) {
  const timeout = ctx.config.get<number>('my-plugin.timeout', 5000);
  const retries = ctx.config.get<number>('my-plugin.retries', 3);
  this.client = new MyClient({ timeout, retries });
}`,
    },
    {
      title: 'Subscribe to plugin events',
      description: 'React to events from other plugins via the bus.',
      code: `ctx.bus.on('my-plugin:action-completed', (payload) => {
  ctx.logger.info('Action completed', { duration_ms: payload.duration_ms });
});`,
    },
  ],
};
```

### Fields explained

#### `tier`

| Value | Meaning |
|---|---|
| `core` | Bundled with ForgeKit, always present |
| `extension` | Official plugin, distributed via npm |
| `community` | Third-party plugin, user-installed |

#### `api[]`

One entry per method/ability the plugin exposes. Include:
- All public methods (even internal helpers become clearer with this)
- Parameters with types and descriptions
- Return type as a string
- One real `example` snippet

#### `dataModels[]`

Define data structures your plugin works with. Even if they're TypeScript interfaces in code, describing them here lets an AI generate correct payloads without reading your source.

#### `events[]`

Every custom event your plugin emits. Include `payloadType` as a string (not TypeScript type — a human-readable type description).

#### `dependencies[]`

How to use each required/optional dependency. Give a concrete `example` code snippet.

#### `usageExamples[]`

Real, runnable code snippets. At least one per API entry or event type.

---

## Step 5: Add Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MyPlugin } from './index.js';

describe('MyPlugin', () => {
  it('should return healthy status', async () => {
    const plugin = new MyPlugin();
    await plugin.init(mockContext());
    await plugin.start();
    const health = await plugin.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.plugin).toBe('@forge/my-plugin');
  });
});

function mockContext() {
  return {
    config: {
      get: (key: string, fallback?: unknown) => fallback,
      set: () => {},
      has: () => false,
      getAll: () => ({}),
      onUpdate: () => () => {},
    },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      child: () => {},
    },
    bus: {
      emit: () => {},
      on: () => () => {},
      once: () => {},
      off: () => {},
    },
  } as never;
}
```

Run tests: `pnpm test`

---

## Step 6: Register in `forge.json`

To include your plugin in the app, add it to the root `forge.json`:

```json
{
  "plugins": [
    { "name": "@forge/config-plugin", "source": "../packages/config-plugin", "enabled": true },
    { "name": "@forge/logger-plugin", "source": "../packages/logger-plugin", "enabled": true },
    { "name": "@forge/my-plugin", "source": "../packages/my-plugin", "enabled": true }
  ]
}
```

---

## Publishing to npm

```bash
cd packages/my-plugin
pnpm build
pnpm publish --access public
```

Your plugin is now installable as `@forge/my-plugin` or `@your-scope/my-plugin`.

---

## Plugin Checklist

Before publishing, verify:

- [ ] `plugin.yaml` manifest complete with all required fields
- [ ] Implements `ForgePlugin` interface with all 4 lifecycle methods
- [ ] Exports `createPlugin` as default function
- [ ] `PluginSpec.ts` has at least one `usageExample`
- [ ] `PluginSpec.tier` correctly set (`core`/`extension`/`community`)
- [ ] Health check returns correct plugin name and version
- [ ] All tests pass
- [ ] No hardcoded config values — always use `ctx.config.get()`
- [ ] All errors use named `ForgeError` codes from `@forge/spec`
