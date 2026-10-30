# Argus — SDLC / Execution Plan

> Status: `DRAFT v0.1` · Cadence: 1-week sprints (solo pace multiplies this, the structure doesn't change).

---

## 1. Process map (industry lifecycle applied here)

```
  ○ Inception ──▶ ○ Elaborate ──▶ ○ Construct ──▶ ○ Transition ──▶ ↻ operate
   (this PRD)      (architecture   (sprints 1-4)   (publish, docs,
  ✔ done           done below)         ▲            CHANGELOG)            saas
                      │                 │ support/bugfix loop  retro/next
                      └── ADRs/PRD are living docs, updated as decisions change──┘
```

## 2. Sprint 0 — Repo foundation (done before Sprint 1 features)

Deliverables:
- [x] PRD, Architecture, Threat model, ADRs (this docs set)
- [ ] Monorepo scaffold (`engine/`, `shell/`, `apps/`, `tests/`), tsconfig, ESLint-extended flat config (npx eslint possible with devDeps — allowed as dev tooling)
- [ ] CI pipeline (GitHub Actions): typecheck → lint → test matrix (ubuntu/windows) → coverage ≥90% engine branch gate
- [ ] Conventional commit + dev branch conventions enforced
- [ ] `record` script for fixture capture
- [ ] `.argus/` artifacts gitignored

Definition of Done (every story, every sprint):
1. Tests written first or with code — branch-coverage gate stays green.
2. No TODO thrown away; crates for future scope become issues not comments.
3. `docs/` updated if architecture changed (ADR spawned if non-obvious).
4. Squash PR ≤ 400 lines.
5. No secrets in code (CI secret-scanning step).

## 3. Sprint plan

### Sprint 1 — "Proof of safety" (MVP verdicts)
| ID | Story                                                                     | TB grasper  | DoD     |
|----|---------------------------------------------------------------------------|-------------|---------|
| S1.1 | Gemini-fast npm Registry connector (ETag, backoff, top-500 list export) | 1           | fixtures recorded |
| S1.2 | OSV.dev advisory connector                                            | 1           | golden corpus for 10 known-CVE packets |
| S1.3 | engine: npm metadata ➜ signals S10,S20,S40,S80                       | 1           | 90%+ branch cov |
| S1.4 | engine: risk merge + verdict gate + evidence DTO                      | 1           | golden tests |
| S1.5 | apps/cli `argus scan npm:<pkg>` + exit codes                          | 1           | e2e passing |

### Sprint 2 — "Radar" (viral detection)
| ID | Story                                                                      | note              |
|----|----------------------------------------------------------------------------|-------------------|
| S2.1 | trend engine: velocity series (stdev burst vs rolling mean)              | pure math, testable |
| S2.2 | collectors: npm downloads bulk + GitHub trending scrapes                | rate-limit budgeted |
| S2.3 | engine: signals S30, S50, S60 (typo-squat Levenshtein vs top-500)        | corpus-validated   |
| S2.4 | `argus trend` (table, --json)                                          | exit code rules    |

### Sprint 3 — "Eyes everywhere" (GitHub + persistence + API)
| ID | Story                                                                      |
|----|----------------------------------------------------------------------------|
| S3.1 | GitHub connector (REST, unauthenticated/token, 5k/h honor)              |
| S3.2 | engine: repo signals S90-S120 + dep-risk propagation via npm analyzer   |
| S3.3 | `argus scan gh:<owner>/<repo>`                                          |
| S3.4 | `.argus/` JSON store (trend snapshots + scan cache with TTL)            |
| S3.5 | apps/api: express-equivalent native HTTP route `/api/trend`, `/api/scan/:ref`, `/healthz` |

### Sprint 4 — "The watchtower" (dashboard + polish + v1 ship)
| ID | Story                                                                       |
|----|-----------------------------------------------------------------------------|
| S4.1 | apps/web: zero-dep static dashboard (fetch ↔ api), trend board + scan drilldown |
| S4.2 | `argus watch` sweep-loop daemon + local notification event                |
| S4.3 | golden corpus grows ≥ 200 real packages, precision/recall report in docs |
| S4.4 | README, threat-model walkthrough, CHANGELOG, v1.0.0 tag                  |

## 4. Versioning / release

```
SemVer.  pre-release α (internal) ──▶ v1.0.0 (MVP, precedence: alpha CLI)
```

## 5. Team-composition mapping (how a 100x eng org would cover this — so even solo, the structure exists)

| 1000-person org role | Mapped into this project by                                  |
|----------------------|---------------------------------------------------------------|
| 100 architects       | `docs/` C4 + ADRs + import-direction CI check                 |
| Senor dev review     | PRD DoD golden verdict review + coverage gate                 |
| 20000 testers        | 4-layer test strategy + golden corpus + e2e (ADR-0004)        |
| SRE                 | CI matrix (ubuntu/windows), `--strict eslint`, health probes  |
| Security engineer    | `03-THREAT-MODEL.md` + W1/W2/W3 non-goals enforcement         |
| PM                   | This file + sprint table + success metrics in PRD             |
