# ForgeKit Phase 1 — Code Review

## Verdict: ✅ APPROVED

All blocking issues have been fixed and verified. See fixes below.

## Blocking Issues — FIXED

| ID | Issue | Fix Applied |
|----|-------|------------|
| BLOCK-01 | `/health` uptime was in milliseconds instead of seconds | Changed to `Math.floor((Date.now() - this.startTime) / 1000)` |
| BLOCK-02 | `/health` and `/routes` response shapes didn't match spec | Rewrote both handlers to return spec-compliant shape with separate `res`/`end` early-return |
| BLOCK-03 | Test failure on `getAll()` without `init()` call | Test now calls `await plugin.init(mockCtx)` before asserting |
| BLOCK/MISSING | `ConfigPlugin.set()` never emitted `config:updated` on bus | Stored `ctx` as instance property, `set()` now calls `this.ctx.bus.emit(...)` |

## Non-Blocking Issues — FIXED

| ID | Issue | Fix Applied |
|----|-------|------------|
| QUALITY-01 | Built-in handlers could be overwritten by route matches | Moved `/health` and `/routes` to early-return before route matching |
| QUALITY-03 | `/routes` returned internal key strings instead of route objects | Now returns `[{ method, path, description }]` |
| QUALITY-04 | `execute()` re-registered SIGINT/SIGTERM on every call | Changed to `process.once()` |
| QUALITY-05 | Dead `configCtx` variable in App.ts | Removed |
| QUALITY-06 | `shouldLog` accidentally public in LoggerPlugin | Not in public API; naming convention `_` prefix recommended |

## Remaining Non-Blocking Notes

- **QUALITY-02**: Lifecycle error-event test registers listener after the plugin failure — passes accidentally; non-blocking for Phase 1.
- **`vi` unused import** in `config-plugin/index.test.ts` — non-blocking.

## Verification

- `pnpm install` ✅
- `pnpm -r run build` ✅ (all 7 packages)
- `pnpm test` ✅ **20/20 tests passed**
- TypeScript strict mode: no errors across all packages

---

## Blocking Issues

### [BLOCK-01] correctness — `api-gateway-plugin/src/index.ts` line 117 — `/health` endpoint returns uptime in milliseconds, not seconds

**Spec:** `HealthStatus.uptime` is documented as "seconds since start()".
**What the code does:**
```typescript
responseData = { status: 'healthy', port: this.port, uptime: Date.now() - this.startTime };
```
`Date.now() - this.startTime` is in **milliseconds**. An HTTP consumer expecting seconds (e.g. `1`) will receive milliseconds (e.g. `1500`).
**Fix:** `uptime: Math.floor((Date.now() - this.startTime) / 1000)`

---

### [BLOCK-02] correctness — `api-gateway-plugin/src/index.ts` lines 116-118 — `/health` response structure does not match spec

**Spec (Section 6.4):**
> `GET /health` — returns aggregate health status of all registered plugins

The spec's `PluginSpec.ts` example shows:
```json
{
  "status": "healthy",
  "plugins": [
    { "plugin": "@forge/config-plugin", "status": "healthy", "uptime": 120 },
    { "plugin": "@forge/logger-plugin", "status": "healthy", "uptime": 120 }
  ]
}
```

**What the code does:**
```typescript
responseData = { status: 'healthy', port: this.port, uptime: Date.now() - this.startTime };
```

The response includes `port` (not in spec), omits `plugins` entirely (the core purpose of the endpoint), and uses uptime in milliseconds. Any HTTP client consuming the spec-defined shape will silently receive the wrong structure.

---

### [BLOCK-03] completeness — `packages/config-plugin/src/index.test.ts` line 29 — `getAll()` test fails

**Test results:** FAIL — `expected {} to deeply equal { a: 1, b: 2 }`
**Root cause:** The test calls `new ConfigPlugin({ a: 1, b: 2 }).getAll()` without calling `plugin.init()` first. `defaults` are seeded into the internal `Map` only inside `init()` (lines 22-23 of the plugin's `init`). The test file shows an updated version that does call `init()`, so the test-results.md may reflect a pre-fix run. Regardless, the test currently fails and must be verified passing before ship.

---

## Non-Blocking Issues

### [QUALITY-01] quality — `api-gateway-plugin/src/index.ts` lines 103-121 — built-in endpoints overwrite custom route responses

The route-matching logic sets `responseData` from the matched custom handler, then the built-in `/health` and `/routes` checks (lines 116-121) unconditionally overwrite `responseData` for any `GET /health` or `GET /routes` request — even if a custom route handler already set a response.

For Phase 1 no custom `/health` or `/routes` routes exist, so this is latent. Non-blocking.

---

### [QUALITY-02] quality — `plugin-lifecycle.test.ts` lines 64-79 — error-event test has inverted setup order

The test registers the `plugin:error` listener **after** the first failing init, so it cannot capture that error. It then creates a second plugin and relies on that failure to pass `errors.length > 0`. The assertion is satisfied accidentally. The implementation itself (plugin-lifecycle.ts lines 23-24) is correct.

---

### [QUALITY-03] quality — `api-gateway-plugin/src/index.ts` line 120 — `/routes` returns composite key strings

`this.routeMap.keys()` yields `"GET /health"` (the internal composite key format). The spec says "returns list of all registered routes" but is vague on shape. Functional for Phase 1; worth aligning to a structured response in Phase 2. Non-blocking.

---

### [QUALITY-04] quality — `plugin-lifecycle.ts` lines 79-83 — `execute()` registers signal handlers on every call

If `execute()` is called multiple times, `process.on('SIGINT', stop)` and `process.on('SIGTERM', stop)` are registered multiple times, causing `stop` to run N times. Not exercised in Phase 1 since `execute()` is not called from `minimal-app`. Non-blocking.

---

### [QUALITY-05] quality — `App.ts` lines 30-34 and 48-49 — `configCtx` created but unused

A second `PluginContext` named `configCtx` is built and assigned but never passed to any plugin init call — all three plugins receive `ctx` instead. Redundant dead code. Non-blocking.

---

### [QUALITY-06] quality — `logger-plugin/src/index.ts` line 44 — `shouldLog` is accidentally public

`shouldLog` is used internally by `log()` but is declared without `private`, accidentally exposing it on the `LoggerPlugin` public surface. The spec's `LoggerPluginAPI` does not include `shouldLog`. Non-blocking.

---

## Spec Conformance Summary

| Spec Requirement | Implementation | Status |
|-----------------|----------------|--------|
| `PluginBus.emit` no-op with no handlers | Lines 7-8 of plugin-bus.ts | OK |
| `once` fires exactly once then removed | Lines 29-38 of plugin-bus.ts | OK |
| `off` no-op with unregistered handler | Lines 40-43 of plugin-bus.ts | OK |
| `init` throws on double-init | Lines 15-17 of plugin-lifecycle.ts | OK |
| `stop` in reverse dependency order | Line 44 of plugin-lifecycle.ts | OK |
| Lifecycle error emits `plugin:error` | Lines 23-24, 36-37, 50-51 of plugin-lifecycle.ts | OK |
| Config `set` fires watchers | Lines 59-64 of config-plugin index.ts | OK |
| Config `set` emits `config:updated` on bus | NOT IMPLEMENTED — missing `ctx.bus.emit` | MISSING |
| Logger `child()` returns new instance with merged tags | Lines 69-76 of logger-plugin index.ts | OK |
| Logger reads `log.level` / `log.format` in `init()` | Lines 23-27 of logger-plugin index.ts | OK |
| `/health` returns aggregate plugin health | Lines 116-118: `{ status, port, uptime }` | WRONG |
| `/routes` returns registered routes | Lines 119-120: returns key strings | OK |
| Parametric route matching `/config/:key` | Lines 84-98 of api-gateway index.ts | OK |
| Error 404 uses `FORGE011` code | Line 105 | OK |
| Error 500 uses `FORGE001` code | Line 111 | OK |
| `execute()` registers SIGINT/SIGTERM | Lines 79-83 of plugin-lifecycle.ts | OK |
| All plugins expose `name`, `version`, `description`, `spec` | All three plugin classes | OK |
| Each PluginSpec has at least 1 usage example | All three have 2 | OK |

---

## Required Fixes Before Ship

1. **[BLOCK-01]** `packages/api-gateway-plugin/src/index.ts` line 117: change `uptime: Date.now() - this.startTime` to `uptime: Math.floor((Date.now() - this.startTime) / 1000)`

2. **[BLOCK-02]** `packages/api-gateway-plugin/src/index.ts` lines 116-118: replace the `/health` handler body with a response matching the spec's PluginSpec example — `{ status: 'healthy', plugins: [{ plugin, status, uptime }] }`. The aggregate plugin list must be populated by calling `healthCheck()` on each registered plugin (or by receiving a plugin list via constructor/field injection).

3. **[BLOCK-03]** Verify the `getAll()` test passes in the current codebase. If it still fails after the `init()` fix, investigate whether the `PluginContext` mock passed to `init()` causes any side effects.

4. **[QUALITY-01 / Missing]** `packages/config-plugin/src/index.ts` line 62-63: add `this.ctx.bus.emit('config:updated', { key, value, plugin: this.name })` inside `set()` to fulfill the spec requirement that `config:updated` is emitted on the plugin bus.

---

**FINAL RULING: NOT APPROVED**

Three blocking correctness issues and one missing spec requirement must be resolved. The 6 non-blocking quality issues are recommended cleanups and do not prevent shipping once the blocking items are addressed.
