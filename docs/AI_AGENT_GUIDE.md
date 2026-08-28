# AI Agent Guide

How to use ForgeKit to collaborate on a codebase as an AI agent.

---

## The Core Insight

Most AI code generation fails on large projects because the AI doesn't know:
- What files exist and why
- What each module is responsible for
- How modules depend on each other
- What the right API is for adding functionality

**ForgeKit solves this with PluginSpec.** Every plugin ships a machine-readable specification. You read the spec first — then write code. No guessing, no context-gathering, no reading thousands of lines of implementation.

---

## The Five-Minute Onboarding Protocol

When you join a ForgeKit project, follow this sequence:

### Step 1: Read the project manifest

```
forge.json
```

This tells you:
- What plugins are in use
- Where each plugin's source is
- The global configuration

```json
{
  "name": "my-app",
  "plugins": [
    { "name": "@forge/config-plugin", "source": "../packages/config-plugin", "enabled": true },
    { "name": "@forge/logger-plugin", "source": "../packages/logger-plugin", "enabled": true },
    { "name": "@forge/api-gateway-plugin", "source": "../packages/api-gateway-plugin", "enabled": true },
    { "name": "@forge/my-plugin", "source": "../packages/my-plugin", "enabled": true }
  ]
}
```

### Step 2: Find your target plugin

If you're working on `@forge/my-plugin`, read:

```
packages/my-plugin/src/PluginSpec.ts
```

This tells you:
- What API methods exist (`api[]`)
- What data structures it uses (`dataModels[]`)
- What events it emits (`events[]`)
- What other plugins it depends on and how (`dependencies[]`)
- Real usage examples (`usageExamples[]`)

### Step 3: Read the manifest

```
packages/my-plugin/plugin.yaml
```

This tells you:
- What this plugin declares as its capabilities
- Its declared dependencies
- Its entry point

### Step 4: Read the implementation

```
packages/my-plugin/src/index.ts
```

You now understand the full picture — spec first, then implementation. The spec tells you what, the implementation tells you how.

### Step 5: Write code against the spec

```typescript
// PluginSpec says:
// - name: 'my-plugin.doAction'
// - parameters: { input: string, options?: MyOptions }
// - returns: Promise<string>

// I can now write:
export class MyPlugin implements ForgePlugin {
  async doAction(input: string, options?: MyOptions): Promise<string> {
    // Implementation
  }
}
```

---

## Working With PluginContext

The `PluginContext` is your interface to everything in ForgeKit.

### Accessing configuration

```typescript
// Read a config value
const timeout = ctx.config.get<number>('my-plugin.timeout', 5000);

// Set a config value (also emits config:updated event)
ctx.config.set('my-plugin.status', 'ready');

// Subscribe to config changes
const unsub = ctx.config.onUpdate((key, value) => {
  ctx.logger.info(`Config changed: ${key}`, { value });
});
// Call unsub() to unsubscribe
```

### Logging

```typescript
ctx.logger.debug('Processing input', { inputLength: input.length });
ctx.logger.info('Action completed', { duration_ms: elapsed });
ctx.logger.warn('Retrying after failure', { attempt: n, maxRetries });
ctx.logger.error('Action failed permanently', { error: String(e) });

// Tagged logger for a subsystem
const dbLogger = ctx.logger.child({ subsystem: 'database' });
dbLogger.info('Query executed', { query, duration_ms });
```

### Event bus

```typescript
// Emit an event
ctx.bus.emit('my-plugin:action-completed', {
  input,
  result,
  duration_ms: elapsed,
});

// Subscribe to an event
const unsub = ctx.bus.on('other-plugin:event', (payload) => {
  // handle payload
});
unsub(); // cleanup when done

// Listen for lifecycle events
ctx.bus.once('forge:ready', ({ app, plugins }) => {
  ctx.logger.info('ForgeKit app ready', { app, plugins });
});
```

---

## Adding a New Plugin

### Scenario: You're told "add a cache plugin"

**Don't start coding.** Follow the protocol:

1. Read `forge.json` → see existing plugins
2. Create `packages/cache-plugin/plugin.yaml` with manifest
3. Create `packages/cache-plugin/src/PluginSpec.ts` defining the cache API
4. Create `packages/cache-plugin/src/index.ts` with stub implementation
5. Verify: does it compile? Do tests pass?
6. Update `forge.json` to include it

---

## Adding a Feature to an Existing Plugin

### Scenario: Add a new method to `@forge/my-plugin`

**Protocol:**

1. Read `packages/my-plugin/PluginSpec.ts` → understand existing API
2. Read `packages/my-plugin/src/index.ts` → understand how other methods are implemented
3. Add the new method to `PluginSpec.api[]` with full documentation
4. Implement the method in `index.ts`
5. Add tests
6. Verify: compile + tests pass

The `PluginSpec` is the contract. Update it first, then implement.

---

## Communication Patterns Between Plugins

Plugins should never import each other directly. All inter-plugin communication goes through the bus or the shared context.

### DO: Event-based communication

```typescript
// In plugin A: emit when something happens
ctx.bus.emit('order:placed', { orderId, amount });

// In plugin B: react to the event
ctx.bus.on('order:placed', (payload) => {
  ctx.logger.info('Order received', { orderId: payload.orderId });
});
```

### DON'T: Direct imports

```typescript
// WRONG — tight coupling, breaks in monorepo
import { ConfigPlugin } from '../config-plugin/index.js';
const config = new ConfigPlugin();
```

### DO: Use the context

```typescript
// RIGHT — loose coupling via context
async init(ctx: PluginContext) {
  const setting = ctx.config.get('my-plugin.setting');
}
```

---

## Handling Errors

Use named error codes from `@forge/spec`:

```typescript
import { ForgeError, ForgeErrors } from '@forge/spec';

try {
  await this.client.connect();
} catch (e) {
  throw new ForgeError(
    ForgeErrors.PLUGIN_INIT_FAILED,
    `Failed to connect: ${String(e)}`,
    this.name,
    e
  );
}
```

Standard error codes:

| Code | When to use |
|---|---|
| `FORGE001` | Plugin init/start/stop failed |
| `FORGE004` | A required plugin was not found |
| `FORGE005` | A declared dependency is missing |
| `FORGE006` | Circular dependency detected |
| `FORGE007` | Failed to load the plugin entry file |

---

## Workflow: Adding a New Plugin to the App

```
1. Create plugin/package/src/PluginSpec.ts
   → Define the API contract first

2. Create plugin/package/src/index.ts
   → Implement ForgePlugin interface
   → Use ctx.config, ctx.logger, ctx.bus
   → No direct imports of other plugins

3. Create plugin/package/plugin.yaml
   → Manifest for registry

4. Create plugin/package/src/*.test.ts
   → Tests for all public methods

5. Update forge.json
   → Add to plugins[] array

6. Run: pnpm build && pnpm test
   → Verify compilation and tests

7. Done — other AI agents can now discover and use this plugin
   by reading its PluginSpec.ts
```

---

## The ForgeKit Mental Model for AI Agents

Think of ForgeKit as a **structured workspace**:

```
┌─────────────────────────────────────────────────────┐
│  forge.json — "What's in this project?"              │
│    └─► plugin.yaml — "What does this plugin do?"    │
│          └─► PluginSpec.ts — "How do I use it?"     │
│                └─► index.ts — "How is it built?"  │
└─────────────────────────────────────────────────────┘
```

Always read bottom-up: start with `forge.json`, then your target plugin's spec, then its implementation.

This structure means you can join any ForgeKit project and be productive in minutes — not hours.

---

## Phase 2 Plugins — What AI Agents Need to Know

### @forge/db-plugin — Write Any Database Code

AI agents do NOT need to know whether the app uses SQLite, PostgreSQL, or MongoDB.
The `ctx.db` interface is the same for all drivers.

Read `packages/db-plugin/src/PluginSpec.ts` → write DB operations.
The PluginSpec tells you every method, parameter type, and example.

### @forge/auth-plugin — JWT Authentication

Use `ctx.auth.sign()` to issue tokens, `ctx.auth.verify()` to validate,
`ctx.auth.middleware()` to protect routes.

Never store passwords in plaintext — use `ctx.auth.hashPassword()` and
`ctx.auth.verifyPassword()`.

### @forge/events-plugin — Cross-Plugin Communication

Emitting events decouples plugins. Plugin A emits `user:created`, Plugin B
subscribes. Neither plugin imports the other directly.

### @forge/spec-generator — Auto-Generate Your PluginSpec

Before writing your plugin spec manually, run the generator:

```bash
node packages/plugin-spec-generator/dist/index.js packages/my-plugin
```

Review the generated `PluginSpec.generated.ts` and merge into your `PluginSpec.ts`.

## forge-cli Workflow

1. `forge new plugin my-feature` — scaffold plugin in `packages/my-feature/`
2. Write `src/index.ts` implementation
3. `node packages/plugin-spec-generator/dist/index.js packages/my-feature` — generate draft spec
4. `forge check --plugin my-feature` — validate spec compliance
5. Fix any errors/warnings
6. Add plugin to `examples/blog-app/forge.json` and test end-to-end
