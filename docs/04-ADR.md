# Argus — Architecture Decision Records

> Format: Y-statement ADRs. Superseded ADRs stay in history (boilerplate shown for the current set).
> Each ADR = one architecture decision with context → decision → consequences.

---

## ADR-0001 — Node.js + TypeScript, zero runtime dependencies

**Context.** CLI + API + dashboard + live data connectors. Team stack: Java/Spring + JS/MERN —
Node fits both skills. Security tooling where supply-chain risk is the product domain must
not itself depend on the ecosystem it polices. Node ≥ 22 runs strict TS via native
type-stripping (`node file.ts`).

**Decision.** Node ≥ 22, TypeScript (strip-types, no build), **zero runtime dependencies** —
built-in `fetch`, `node:test`, `node:http`. Dev tooling (typecheck, etc.) may use devDeps only.

**Consequences.**
- ✅ Supply chain of the product itself is auditable end-to-end (T6 eliminated).
- ✅ No `npm i` needed to develop — clone and run.
- ⚠ Hand-rolled service fetch layer, arg parsing, HTML dashboard — more of our own code, but each is small and test-covered.
- ⚠ Type-stripping requires Node ≥ 22.13 for full TS coverage — documented in README.

## ADR-0002 — Hexagonal architecture: pure `engine/` core, adapters at the perimeter

**Context.** Scoring logic must be unit-testable at ≥ 90% branch coverage with zero network;
connectors mutate data monthly; CLI/API/watch are three different front doors to the same brain.

**Decision.** Three-ring layout: `engine/` (pure — no I/O, no clock, no fetch),
`shell/` (adapters: connectors, persistence, process exit), `apps/` (cli, api, web).
Engine receives ports (`Clock`, `Registry`, `Advisories`, `Store`) via arguments; composition
happens only in `shell/main.ts`. CI script enforces the import direction rule.

**Consequences.**
- ✅ Full engine testability with fixtures, no mocks-of-third-party-code.
- ✅ CLI, dashboard, CI pipeline all get identical verdicts by construction.
- ⚠ Slightly more files; mitigated by strict one-construct-per-file convention.

## ADR-0003 — Persistence: JSON snapshot store (v1) behind a port, SQLite (v2) candidate

**Context.** Trend sweeps and scan caches need durability; v1 is a local tool;
installing a native module (`better-sqlite3`) would violate ADR-0001 zero-dep for dev less-time runs.

**Decision.** `engine` sees a `TrendStore` port. v1 implements it as append-only JSON +
snapshot store under `.argus/` (status: gitignored artifacts). SQLite via `node:sqlite`
(built-in since Node 22.5, stable flag-gated — reassess at v2) as upgrade path, same port.

**Consequences.**
- ✅ No file-format lock-in; store can be swapped without engine changes.
- ✅ `.argus/` artifacts are inspectable, diffable, and human-readable.
- ⚠ No query engine yet — in-memory filtering is fine at v1 scale (10³ records).

## ADR-0004 — Testing strategy: fixture-recorded providers, deterministic engine, golden verdicts

**Context.** Scan correctness is the product. Live providers are flaky/non-deterministic;
CI must be hermetic.

**Decision.** Four test layers, all zero-dep (`node:test`):
1. **Unit** — pure engine rules; ≥ 90% branch coverage gate.
2. **Integration** — real HTTP layer against **recorded fixtures** ("golden tapes") of
   real provider responses; recorded by a separate `record` script, never run in CI.
3. **Golden verdicts** — corpus of real packages (known-bad + known-good) with committed
   expected verdicts; any score drift fails CI and requires explicit human review.
4. **E2E** — `argus scan` on the CLI via spawn, assert exit codes + output shape.

**Consequences.**
- ✅ CI never hits the network → deterministic, fast (<60s), flake-free.
- ✅ Regression drift on scores is a visible, reviewable code change.
- ⚠ Fixtures must be refreshed deliberately; pinned with provider-version metadata.

## ADR-0005 — Trunk-based development, single CI gate, conventional commits

**Context.** Solo + contributors; long-lived feature branches rot, PRs become megadiffs.

**Decision.** `main` is always releasable. Short-lived branches (<2 days), squash-merge,
Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`), single CI pipeline:
`typecheck → lint → unit → integration → golden → e2e → coverage gate`.
No merge without green CI. Releases: tags `vX.Y.Z`, CLI published from tag build only.

**Consequences.**
- ✅ History is reviewable prose, blame-clean.
- ⚠ Mergers must keep diffs small (revert-easy).
