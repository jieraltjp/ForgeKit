# Contributing to ForgeKit

Thank you for contributing to ForgeKit! This guide covers everything you need to know to contribute effectively.

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 11+

### Setup

```bash
git clone https://github.com/jieraltjp/ForgeKit.git
cd ForgeKit
pnpm install
pnpm build
pnpm test
```

Verify everything passes before making changes:
- `pnpm build` — compiles all packages
- `pnpm test` — runs all tests (expect 20+ passing)

---

## Development Workflow

### 1. Create a branch

```bash
git checkout -b feat/my-new-plugin     # new plugin
git checkout -b fix/some-bug          # bug fix
git checkout -b docs/improve-guide     # documentation
```

Branch naming convention:
- `feat/` — new plugins or features
- `fix/` — bug fixes
- `docs/` — documentation improvements
- `refactor/` — code refactoring without behavior change
- `chore/` — tooling, CI, dependency updates

### 2. Make your changes

Follow the [Plugin Authoring Guide](docs/PLUGIN_SPEC.md) if adding a new plugin.

General rules:
- Always add tests for new functionality
- Update `PluginSpec.ts` when changing plugin behavior
- Run `pnpm build && pnpm test` before committing
- Use named error codes from `@forge/spec`, not raw strings

### 3. Verify

```bash
pnpm build       # TypeScript compiles without errors
pnpm test        # All tests pass
```

### 4. Commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(config-plugin): add FORGE_ prefix env var support"
git commit -m "fix(api-gateway): correct uptime in /health to seconds"
git commit -m "docs: add database plugin guide"
git commit -m "test(logger-plugin): add child() tag inheritance test"
```

### 5. Push and open a PR

```bash
git push origin feat/my-new-plugin
```

Open a Pull Request on GitHub. Include:
- What the change does
- Why it was needed
- How to test it

---

## What to Contribute

### High-value contributions

| Area | What to add |
|---|---|
| New core plugins | `@forge/db-plugin`, `@forge/auth-plugin`, `@forge/events-plugin` |
| Plugin spec generator | Auto-generate `PluginSpec.ts` from code annotations |
| `forge-cli` | `new`, `check`, `generate`, `list` commands |
| Documentation | Examples, guides, tutorial |
| Tests | Coverage for edge cases in existing plugins |

### Contribution standards

- **New plugins** must include a complete `PluginSpec.ts` with at least one `usageExample`
- **Bug fixes** must include a regression test
- **Breaking changes** require a major version bump and migration guide
- **Documentation** must be in English with clear, concise prose

---

## Code Style

- TypeScript strict mode is always on
- Use named exports, not default where it makes sense
- All imports use `.js` extensions (ES modules)
- Error codes from `@forge/spec` — never hardcode error strings

```typescript
// Good
import { ForgeError, ForgeErrors } from '@forge/spec';
throw new ForgeError(ForgeErrors.PLUGIN_INIT_FAILED, 'Connection failed', this.name, e);

// Bad
throw new Error('Plugin init failed: connection error');
```

---

## Project Structure

```
ForgeKit/
├── packages/
│   ├── forge-spec/          ← Types, interfaces, error codes (read-only shared)
│   ├── forge-core/          ← Runtime engine (changing)
│   └── */                   ← Plugins (add new ones here)
├── examples/
│   └── minimal-app/         ← Reference app
├── docs/
│   ├── ARCHITECTURE.md      ← System architecture
│   ├── PLUGIN_SPEC.md       ← Plugin authoring guide
│   └── AI_AGENT_GUIDE.md    ← AI collaboration guide
└── .pipeline/               ← Implementation pipeline artifacts
```

---

## Reporting Issues

When reporting a bug, include:
- ForgeKit version (`node packages/forge-core/dist/index.js --version` or check `package.json`)
- Steps to reproduce
- Expected vs actual behavior
- Minimal reproduction case if possible

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
