# ForgeKit — AI-Native Plugin Skeleton System

## 1. Concept & Vision

**Forge** is an open-source plugin skeleton framework designed for AI-native software development. Think of it as **Spring Cloud for AI collaboration** — a standardized, composable system where multiple AI agents can work simultaneously on different plugins without stepping on each other, with every plugin self-documenting and independently testable.

The core thesis: **complex AI-generated codebases fail not because AI can't write code, but because AI lacks structure, contracts, and discoverability.** Forge provides the structural skeleton that makes multi-agent, multi-file, multi-module software engineering tractable.

Target outcome: an open-source GitHub project that gives any AI agent (Claude, GPT, Gemini, etc.) the ability to join a project, understand its structure in seconds, claim a plugin, generate code against the plugin API, and integrate seamlessly.

---

## 2. Problem Statement

AI code generation suffers from:
- **Context explosion**: Larger projects = AI loses track of what's where
- **No plugin contracts**: Plugins lack standardized interfaces, breaking integration
- **No discoverability**: New AI agents can't understand a codebase without extensive human briefing
- **No coordination**: Multiple AIs working simultaneously create merge conflicts and overwritten code
- **No quality gates**: No standardized testing, linting, or documentation enforcement per plugin
- **Spring Cloud solves this for microservices** — but nothing solves it for AI-collaborative development

---

## 3. Core Value Proposition

| Dimension | Without Forge | With Forge |
|---|---|---|
| New AI agent onboarding | Hours of reading context | 5 minutes of structured discovery |
| Plugin integration | Custom per-project wiring | Standard API contract, auto-wired |
| Multi-agent coordination | Manual human orchestration | Claim-check-commit protocol |
| Quality gates | Ad-hoc | Per-plugin CI pipeline |
| Documentation | Often missing | PluginSpec-first, auto-generated |

---

## 4. Target Users

- **Individual developers** using multiple AI sessions on one project
- **AI agent orchestration frameworks** (AutoGen, CrewAI, LangChain agents)
- **Internal teams** building shared plugin libraries
- **Open source maintainers** wanting AI-contributable plugins

---

## 5. System Architecture

### 5.1 Project Structure

```
forge/
├── forge-core/              # The runtime engine
│   ├── src/
│   │   ├── plugin-registry.ts     # Plugin discovery & registration
│   │   ├── plugin-loader.ts        # Dynamic plugin loading
│   │   ├── plugin-bus.ts           # Inter-plugin communication bus
│   │   ├── plugin-lifecycle.ts     # Init, start, stop, health
│   │   └── plugin-context.ts       # Shared context (config, logger, store)
│   └── tests/
├── forge-cli/               # Developer CLI tool
│   ├── commands/
│   │   ├── new-plugin.ts          # forge new plugin <name>
│   │   ├── list-plugins.ts         # forge list
│   │   ├── generate.ts             # forge generate <plugin> <component>
│   │   ├── check.ts                # forge check --plugin <name>  (verify plugin spec compliance)
│   │   └── run.ts                  # forge run
│   └── index.ts
├── forge-spec/              # Plugin specification schema
│   ├── plugin-spec.schema.json
│   ├── api-contract.ts             # Standard plugin API interface
│   ├── events.ts                   # Standard event types
│   └── errors.ts                   # Standard error codes
├── examples/                # Example plugins & full systems
│   ├── auth-plugin/               # Authentication plugin
│   ├── db-plugin/                 # Database abstraction plugin
│   ├── api-gateway-plugin/        # API gateway plugin
│   ├── config-plugin/             # Configuration center plugin
│   └── full-stack-app/            # Composed application using all above
├── docs/
│   ├── SPEC.md
│   ├── ARCHITECTURE.md
│   ├── PLUGIN_SPEC.md             # How to write a plugin
│   └── AI_AGENT_GUIDE.md          # How AI agents should use Forge
├── forge-ci/                # Per-plugin CI pipeline template
│   └── plugin-pipeline.yml
└── README.md
```

### 5.2 Plugin Interface Contract

Every plugin MUST implement this interface:

```typescript
// forge-spec/api-contract.ts
export interface ForgePlugin {
  // Identity
  name: string;               // kebab-case, unique across ecosystem
  version: string;            // semver
  description: string;

  // Capabilities
  dependencies: string[];     // plugin names this depends on
  provides: string[];         // capabilities this plugin provides
  events: string[];           # events this plugin emits

  // Lifecycle
  init(ctx: PluginContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;

  // API surface (plugin-specific REST/gRPC endpoints)
  routes?: RouteDefinition[];

  // PluginSpec self-document (every plugin has one)
  spec: PluginSpec;
}

export interface PluginSpec {
  // Auto-generated from implementation, but must be manually reviewed
  api: APIDefinition[];       // What endpoints/abilities this plugin exposes
  dataModels: ModelDefinition[]; // What data structures it uses
  events: EventDefinition[];   // What events it can emit
  dependencies: DependencyDefinition[]; // How to integrate with each dep
  usageExamples: UsageExample[]; // Code snippets showing how to use
  tier: 'core' | 'extension' | 'community'; // Core bundled vs external
}
```

### 5.3 Plugin Bus (Inter-Plugin Communication)

```typescript
// Three modes of communication:
// 1. Direct call (synchronous) — plugin → plugin via injected interface
// 2. Event bus (async) — plugin publishes to bus, others subscribe
// 3. API call (HTTP) — plugin exposes REST endpoint

type PluginCall = {
  target: string;         // plugin name
  method: string;         // method on the target plugin interface
  args: unknown[];
  timeout?: number;
};

type PluginEvent = {
  source: string;         // plugin name
  event: string;          // event type
  payload: unknown;
  timestamp: number;
};
```

### 5.4 Plugin Lifecycle & Coordination Protocol

```
Agent wants to contribute to plugin P:
1. Agent reads forge.json in repo → list of all plugins
2. Agent reads plugins/P/plugin.yaml → understands P's API & contract
3. Agent calls `forge claim plugin P` → acquires write lock (git branch lock)
4. Agent writes code following plugin.yaml spec
5. Agent calls `forge check --plugin P` → validates spec compliance
6. Agent opens PR → CI runs forge check + tests + lint + docs
7. Maintainer reviews & merges → plugin auto-registers in next release
```

---

## 6. Plugin Registry & Discovery

### 6.1 forge.json (Project Manifest)

```json
{
  "name": "my-forge-app",
  "version": "1.0.0",
  "forgeVersion": ">=1.0.0",
  "plugins": [
    {
      "name": "auth-plugin",
      "version": "^2.1.0",
      "source": "./plugins/auth-plugin",
      "enabled": true
    }
  ],
  "globalConfig": {
    "logLevel": "info",
    "apiBasePath": "/api/v1"
  }
}
```

### 6.2 Plugin Discovery Flow

```
forge-core startup:
1. Read forge.json → get plugin list
2. For each plugin: load plugin.yaml + plugin implementation
3. Validate: all dependencies resolvable?
4. Topological sort: init plugins in dependency order
5. Start all plugins
6. Register health checks
7. Emit 'forge:ready' event
```

---

## 7. Core Plugins (Bundled with Forge)

| Plugin | Purpose | Dependencies |
|---|---|---|
| `@forge/core-config` | Centralized configuration management | — |
| `@forge/core-logger` | Structured logging with plugin tagging | — |
| `@forge/core-api-gateway` | Unified HTTP entry point, routes to plugins | core-config, core-logger |
| `@forge/core-auth` | JWT-based authentication | core-config |
| `@forge/core-db` | Database abstraction (SQL + NoSQL adapters) | core-config |
| `@forge/core-events` | Event bus (in-memory + Redis adapter) | core-config, core-logger |

---

## 8. AI Agent Workflow

### 8.1 Onboarding a New AI Agent

```
Given a Forge project, AI agent:
1. Read forge.json → understand all plugins in use
2. For target plugin: read plugin.yaml → understand:
   - What API methods exist
   - What events it emits
   - What plugins it depends on
   - How to extend it
3. Read src/ directory structure of target plugin
4. Read tests/ for test conventions
5. Read examples/ in PluginSpec for usage patterns
6. Write code, ensuring spec compliance
7. Run forge check --plugin <name>
8. Fix any violations
```

### 8.2 Agent Coordination Protocol

- **Claim system**: Agents coordinate via `forge claim` command (git branch locking)
- **Event-based decoupling**: Plugins communicate via events, not direct imports — agents work independently
- **Spec-first**: All plugins have PluginSpec — agents always have a contract to work against
- **Structured logging**: Every log tagged with plugin name — easy to trace which agent's work

---

## 9. Tech Stack

**Decision: TypeScript/Node.js**

Rationale:
- Best language for plugin systems (dynamic loading, reflection)
- Works with Claude, GPT, Gemini natively
- Largest AI tooling ecosystem (LangChain, etc.)
- Universal: backend (Node), desktop (Electron/Tauri), CLI
- `@nestjs/core` patterns for DI and module system

**Stack:**
- Language: TypeScript 5.x
- Runtime: Node.js 20+
- Package manager: pnpm (for monorepo + workspace support)
- Framework patterns: NestJS-inspired (decorators, DI, modules)
- Testing: Vitest
- Linting: ESLint + custom Forge spec rules
- CI: GitHub Actions (template in forge-ci/)
- Publishing: npm (plugins as npm packages, discoverable via npm tag @forge)

---

## 10. Open Questions (Confidence < 95%)

| # | Question | Options | Blocking Implementation? |
|---|---|---|---|
| OQ1 | Plugin communication: gRPC vs REST vs both? | REST only, gRPC optional, both | No (both feasible) |
| OQ2 | Plugin isolation: sandboxed (Worker threads) or shared process? | Sandboxed, Shared process, Configurable | No |
| OQ3 | Plugin versioning: independent per plugin or aligned? | Independent (semver), Aligned (monorepo) | No |
| OQ4 | Authentication between plugins: mTLS, API keys, or trust boundary? | mTLS, API keys, Trust boundary | No |
| OQ5 | Persistence: built-in DB plugin or pluggable storage? | Built-in @forge/core-db, External only | No |
| OQ6 | Package registry: npm only or also Git submodule? | npm, Git submodules, Both | No |
| OQ7 | Core plugin count: start with 6 (above) or fewer? | 6 core, 3 core (min viable) | No |
| OQ8 | Full example app: what domain? | Todo app, E-commerce, Blog/CMS, or generic | No |
| OQ9 | Plugin hot-reload: yes/no in v1? | Yes, No | No |
| OQ10 | AI agent coordination: built-in claim system or external tooling? | Built-in forge claim, External only | No |

---

## 11. Implementation Phases

### Phase 1: Core Skeleton (v0.1.0) — **This session**
- forge-core: plugin registry, loader, lifecycle, bus
- forge-spec: plugin interface, schema, errors, events
- 2-3 core plugins (config, logger, api-gateway)
- PluginSpec for each core plugin
- Basic CI pipeline template
- One full example: API gateway + config + logger composed

### Phase 2: Developer Experience (v0.2.0)
- forge-cli: full command suite (new, list, generate, check, run)
- Plugin spec validation tool (forge check)
- Plugin spec generator (reads plugin code, outputs plugin.yaml)
- Hot-reload development mode

### Phase 3: Ecosystem (v0.3.0)
- npm registry setup: @forge/auth, @forge/db, @forge/events
- Plugin discovery tool
- Plugin marketplace (simple, just a curated list)
- AI Agent guide documentation

### Phase 4: Open Source Launch (v1.0.0)
- Full docs site
- GitHub Actions CI for all core plugins
- Contributing guide
- Full example app (E-commerce domain)

---

## 13. Name: **ForgeKit**

> **Forge** = 锻造、打磨 — AI 生成代码的过程
> **Kit** = 工具包、组件系统 — 可组装、可扩展
>
> 为什么不是单纯 "Forge"：Forge 是动词，强调过程；ForgeKit 是完整的工具包，强调开箱即用。
>
> GitHub repo: `forgekit` / `forge-kit` — 待确认

---

## 14. All Decisions Confirmed (2026-08-27)

| Decision | Choice |
|---|---|
| 插件通信协议 | REST API |
| Phase 1 核心插件数量 | 3个（config + logger + api-gateway），留扩展口 |
| 持久化策略 | **数据库插件抽象所有 DB 类型**，AI 读 PluginSpec 即可生成任意数据库代码 |
| 完整示例 | 任意业务（架子在，AI 说什么就能做什么）|
| 总体策略 | **Spec-first** — 所有插件必须有 PluginSpec，AI 照着 Spec 就能干活 |

---

## 15. Database Plugin Philosophy

核心洞察：**一万种数据库，对 AI 来说应该是同一种操作体验。**

```
AI 不需要知道用的是 MySQL / PostgreSQL / MongoDB / Redis / Elasticsearch
AI 只需要看 Database Plugin 的 PluginSpec：

PluginSpec 告诉 AI:
  - 如何定义一个 Model/Entity
  - 如何做 CRUD（create, read, update, delete, search）
  - 如何做迁移（migration）
  - 如何建索引
  - 如何做事务
  - 如何做聚合查询

底层驱动可插拔（mysql2, pg, mongodb, ioredis...）
PluginSpec 是统一的，AI 写一次，处处可用。
```

---

## 16. Confidence Tracker — FINAL

| Area | Confidence |
|---|---|
| 项目概念与定位 | ✅ 98% |
| 插件接口契约 | ✅ 95% |
| 插件间通信（REST） | ✅ 95% |
| 项目结构 | ✅ 95% |
| 技术栈（TS/Node.js） | ✅ 95% |
| 数据库插件抽象哲学 | ✅ 95% |
| AI Agent 工作流 | ✅ 95% |
| Phase 1 规划 | ✅ 95% |
| 扩展性预留 | ✅ 95% |

**Overall: ✅ 95% — 确认可以进入实现阶段。**

---

## 17. Implementation Status

### ✅ Phase 1 Complete (v0.1.0)

**Code:**
- `packages/forge-spec/` — 8 files: types, errors, events, JSON Schema
- `packages/forge-core/` — 10 files: PluginBus, Registry, Loader, Lifecycle, Context
- `packages/config-plugin/` — config with FORGE_* env override
- `packages/logger-plugin/` — structured JSON/text logging with child()
- `packages/api-gateway-plugin/` — HTTP server, parametric routes, /health, /routes
- `examples/minimal-app/` — composed app wiring all 3 plugins
- **20/20 vitest tests passing, TypeScript strict mode clean**

**Documentation:**
- `README.md` — project overview, architecture diagram, quick start, plugin examples
- `docs/ARCHITECTURE.md` — lifecycle, bus patterns, context injection, registry, loader, config, logger, API gateway
- `docs/PLUGIN_SPEC.md` — complete plugin authoring guide with step-by-step
- `docs/AI_AGENT_GUIDE.md` — AI onboarding protocol, 5-minute discovery, PluginSpec-first workflow
- `CONTRIBUTING.md` — contribution workflow, standards, project structure

**GitHub:** `phase-1` branch — ready for review

### 📋 Phase 2 Planning

| Feature | Priority | Notes |
|---|---|---|
| `forge-cli` | P0 | `forge new plugin`, `forge check`, `forge generate` |
| Dynamic plugin loading | P0 | Load from `node_modules`, replace hardcoded wiring |
| Plugin spec generator | P1 | Auto-generate `PluginSpec.ts` from code |
| `@forge/db-plugin` | P1 | Database abstraction, SQL + NoSQL via spec |
| Hot reload | P2 | Watch mode, reload plugins without restart |
| `@forge/auth-plugin` | P2 | JWT authentication |
| `@forge/events-plugin` | P2 | Redis-backed event bus adapter |
| Plugin spec validator | P1 | `forge check` validates PluginSpec compliance |
| Full example app | P1 | Real domain to prove the架子 |

---

*Last updated: 2026-08-27*
*Status: Phase 1 ✅ complete — documentation ✅ done — Phase 2 ready to start*

