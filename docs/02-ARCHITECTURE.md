# Argus — Architecture

> Status: `DRAFT v0.1` · Method: C4 (Context / Container / Component) + Hexagonal ports & adapters.

---

## 1. C4 L1 — System Context

```
 ┌──────────────┐  scan/scan+exit code   ┌─────────────────────────────┐
 │  Developer   │ ─────────────────────▶ │                             │
 │ (CLI / CI)   │  verdict+evidence      │                             │
 └──────────────┘                        │                             │
 ┌──────────────┐  browse/inspect feed   │           ARGUS             │
 │  Dashboard   │ ◀─────────────────────▶│   (supply-chain radar)      │
 │   user       │                        │                             │
 └──────────────┘                        └───┬────────┬────────┬───────┘
                                             │        │        │
                                    read-only│        │        │
                                             ▼        ▼        ▼
                                      ┌────────┐ ┌─────────┐ ┌────────┐
                                      │  npm   │ │ GitHub  │ │ OSV.dev│
                                      │registry│ │   API   │ │ vulnDB │
                                      └────────┘ └─────────┘ └────────┘
                                       (data)     (data)      (data)
```

## 2. C4 L2 — Container View (Hexagonal / Ports & Adapters)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            ARGUS WORKSPACE (monorepo)                       │
│                                                                             │
│  ┌────────────────────────────  DRIVING  ────────────────────────────────┐  │
│  │                                                                        │  │
│  │   apps/cli (argus)                apps/api                apps/web     │  │
│  │   ├─ scan  <ref>                  ├─ GET /api/trend       dashboard    │  │
│  │   ├─ scan wk (workspace deps)     ├─ GET /api/scan/:ref   (static HTML │  │
│  │   ├─ trend                        ├─ GET /api/proc/:id     + fetch)    │  │
│  │   ├─ trend (--json|--web)         └─ GET /healthz                      │  │
│  │   ├─ watch (sweep loop)                                                │  │
│  │   └─ proc (evidence explorer)      poll/JSON                          │  │
│  │                       │                    ▲                            │  │
│  └───────────────────────┼────────────────────┼───────────────────────────┘  │
│                          ▼                    │                              │
│                   ┌──────────────────────────────────────┐                   │
│                   │          core (the engine)           │                   │
│                   ├──────────────────────────────────────┤                   │
│                   │  ports:                              │                   │
│                   │   › RegistryProvider (npm pkgs)      │                   │
│                   │   › RepoProvider      (git repos)    │                   │
│                   │   › AdvisoryProvider  (vulns)        │                   │
│                   │   › TrendStore  (persist)            │                   │
│                   │                                       │                   │
│                   │  domain:                             │                   │
│                   │   › orchestration (analyzeRef,      │                    │
│                   │     sweep, publisher)                │                   │
│                   │   › signals/* (each = one rule)      │                   │
│                   │   › risk (weighted merge+verdict)    │                   │
│                   │   › explain (evidence chain DTO)     │                   │
│                   │   › trend (velocity series math)     │                   │
│                   │                                       │                   │
│                   │  driven ports (implemented by shell):│                   │
│                   │   › adapters in shell/connectors/    │                   │
│                   │     + shell/persistence/ (Sprint 3)  │                   │
│                   │   › apps are execution boundaries    │                   │
│                   │                                       │                   │
│                   │  PURE — functions+data only, no IO   │                   │
│                   └──────┬──────────────┬────────────────┘                  │
│                          │              │                                   │
│                          ▼              ▼                                   │
│  ┌──────────────── DRIVEN (adapters) ────────────────────────────────────┐  │
│  │  apps/* wire into core via composition root (shell/main.ts)            │  │
│  │  core receives adapter implementations through its ports                │  │
│  │                                                                        │  │
│  │   shell/connectors/          shell/persistence/                        │  │
│  │   ├─ npm-registry.ts         └─ .argus/ JSON store (planned — Sprint 3) │  │
│  │   ├─ github-api (Sprint 3)                                             │  │
│  │   ├─ osv-dev                                                           │  │
│  │   └─ retry/backoff + for-429 body discard + per-call budgets            │  │
│  │      (token-bucket limiter deferred, ADR-0001 v2)                       │  │
│  │                                                                        │  │
│  │   shell/collectors/                                                    │  │
│  │   ├─ downloads-stream (1 fetch → N packages per call)                   │  │
│  │   └─ github-watchers (trending URLs → repo refs)                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Rules enforced by review checklist**
- `core` must not import `shell/` or `apps/` (CI-gated via dep check script).
- All clock reads / randomness in `core` come from injected `ports.Clock` — engine stays deterministic.
- Apps may only construct adapters + call orchestration entry points.

## 3. C4 L3 — Component Detail: one scan (npm package)

```
   argus scan npm:slopy
        │
        ▼
┌─ apps/cli/main ────────────────────────────────────────────────────────────┐
│ parse argv → engine.analyzeRef(ref) → ScanReport → verdict → exit code      │
└───────────────────────────────────────────────────────────────────────────┘
        │ wants: metadata, version list, publish age, advisories
        ▼
engine/orchestrator (`scanRef(ref)`)
  1. `RegistryProvider.getPackage(name)`           → metadata, version list (ports)
  2. `RegistryProvider.getWatchStats(name)`        → download velocity, dependents
  3. `AdvisoryProvider.get(userData)` (OSV)        → known CVE entries
  4.  run signal pipeline (P10..P80)  ─────── see §4
  5. `mergeSignals()` → verdict + evidence chain
  6.  cache.setItem(ref+TTL, verdict)              → TrendStore port
  7.  return `ScanReport`                          → caller renders
```

```
   Provider interface (all data sources implement):
   ┌────────────────────────────────────────────────────────┐
   │ interface DataProvider {                               │
   │   readonly sourceKind: 'registry'|'repo'|'advisories'   │
   │   fetch(input: Ref): Promise<ProviderRecord>            │
   │   // impl MUST be: backoff, ETag, timeout, per-src TL   │
   │ }                                                      │
   └────────────────────────────────────────────────────────┘
```

## 4. Component Detail: Signal Pipeline (the differentiator)

```
                          ┌───────────────────────────┐
   raw provider data ───▶ │      signal/registrar     │
   (npm metadata,         │  (ordered, named rules,   │
    velocity, advisories) │   each PURE fn(data_ctx)  │
                          └────────────┬──────────────┘
                                       │
                     each signal emits: │  {id, weight, evidence, verdict}
                                       ▼
        ┌──────────────────────────────────────────────────────────────┐
        │   weighted merge + veto rules (verdict gate)                  │
        │   verdict ∈ { SAFE, NEEDS_REVIEW, HIGH_RISK, CRITICAL }       │
        └────────────┬─────────────────────────────────────────────────┘
                     ▼
             evidence chain (JSON, ordered, deterministic)
```

### 4.1 npm signals (v1)

| ID   | Signal                       | Heuristic (v0 draft — data-driven tuning later) | Data source |
|------|------------------------------|--------------------------------------------------|-------------|
| S10  | Known CVE (OSV hit)          | any entry → at least NEEDS_REVIEW; high-sev → HIGH_RISK | OSV |
| S20  | Install lifecycle scripts    | pre/postinstall/build hooks that exec network or fs | registry metadata |
| S30  | Fresh-publish.vel mismatch   | ver published <24h && downloads spike → HIGH_RISK | registry |
| S40  | Single-maintainer on high-traffic pkg | strong risk | registry |
| S50  | Maintainer account age       | <30 days owning popular name | registry (github) |
| S60  | Typosquat distance           | Levenshtein ≤2 vs top-500 pkg name, not a fork | registry (top list) |
| S70  | Anomaly: version churn       | ≥8 versions in 24h + velocity spike | registry |
| S80  | Repo↔package linkage absent  | package published but no referenced repo | registry metadata |

### 4.2 GitHub signals (Sprint 3, planned)

| ID   | Signal                | Heuristic                                  |
|------|-----------------------|--------------------------------------------|
| S90  | Repo trust basics     | no license/readme/security policy          |
| S100 | Viral-no-history      | star velocity 1000+ over 48h, <10 commits  |
| S110 | npm deps risk propagation | any dep CRITICAL/HIGH_RISK → repo inherits floor |
| S120 | Fresh commit reshuffle | force-push/rewrite near release (hijack signature) |

## 5. Data Flow: `argus trend` (velocity detection)

```
  collectors ────▶ trend.Series ────▶ report
   (npm DL         (e.g. obj of        rendered JSON/feed
    2 calls,        weighted deltas)
    github
    trending)
      ↑                              cached in shell/persistence (TTL 5min)
      └── rate-limited, ETag-aware
```

## 6. Key Technology Decisions (summarized — full records in 04-ADR.md)

- Node ≥ 22 (native `fetch`, `node:test` strip-types) — **zero runtime deps**.
- TypeScript (type-stripped execution, no build step) — ships as source.
- Hexagonal core: pure engine, adapters at perimeter.
- Persistence v1: JSON snapshot store (gitignore'd) → SQLite (ADR-3 planned) — same port.
- Dashboard: no framework-server; static HTML + native `fetch` against `apps/api`.

## 7. Scaling Path (from laptop → org)

```
  v1  laptop CLI + JSON store        (no server, SDK-first)
  v2  single api host + SQLite WAL   (team feed)
  v3  postgres + worker queue +      (org incid, watch sweeps on
       auth (OIDC), webhooks          schedule, SLAs, RBAC)
  v4  distributed collectors,        (multi-region, marketplace
       streaming trend pipeline,      of signals, third-party
       pluggable signal packs         signal providers)
```

Core engine code never changes across 1→4: that is the point of the seams.
