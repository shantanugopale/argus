# ARGUS · supply-chain radar

**What's trending right now — and is it safe to install, right now.**

Argus fuses real-time ecosystem virality with real-time supply-chain risk verification
into one pre-install gate. Scan any npm package before `npm i`; get a verdict of
`SAFE / NEEDS_REVIEW / HIGH_RISK / CRITICAL` with an **explainable evidence chain**.

Covers hijacked-maintainer attacks, fresh-publish download spikes, typosquats/slopsquats,
install-time script execution, single-maintainer bus-factor, version-churn bursts,
missing repository linkage, and known CVEs (OSV.dev) — with never-a-lie degraded mode.

For the full product context: `docs/01-PRD.md`, `docs/02-ARCHITECTURE.md`,
`docs/03-THREAT-MODEL.md`, `docs/04-ADR.md`, `docs/05-SDLC-PLAN.md`.

## Requirements

- **Node ≥ 22.13** — that's it. Zero runtime dependencies (ADR-0001). TypeScript ships
  as source and runs via native type-stripping; no build step.

## Usage

```bash
node apps/cli/argus.ts scan chalk            # pretty evidence render
node apps/cli/argus.ts scan npm:left-pad --json   # machine-readable report
node apps/cli/argus.ts scan chalk lodash     # batch, aggregated worst verdict
```

CI exit codes: `0` SAFE · `10` NEEDS_REVIEW · `20` HIGH_RISK/CRITICAL ·
`3` not found · `4` degraded · `5` unexpected.

Sample verdict (real scan, 2026):

```
ARGUS · supply-chain radar  scan npm:request

verdict ▮▮▮▯▯▯▯▯▯▯  30/100 NEEDS REVIEW

evidence
◇ S10 Known vulnerabilities (+30)
    OSV.dev lists 2 advisories for this package; worst severity MODERATE: GHSA-7xfp-9c55-5vqj
```

## Development

```bash
npm install          # dev tooling only (tsc, eslint) — runtime stays zero-dep
npm run typecheck    # strict tsc gate
npm run lint         # eslint flat config gate
npm test             # 4-layer suite, hermetic (fixtures, no network): 49 tests
npm run record       # re-record live provider fixtures into tests/fixtures/
```

Engine (`engine/`) is pure — no I/O, injected clock — so the identical code serves CLI,
API and dashboard. Adapters live in `shell/connectors/`; front doors in `apps/`.
CI enforces all four gates plus a coverage gate on every PR (`.github/workflows/ci.yml`).

## Status

Sprint 1 (MVP verdict engine + CLI) shipped — Sprint 2 (trend/velocity radar,
`argus trend`) is next per `docs/05-SDLC-PLAN.md`.

> Codename **Argus** — npm-publish name collision check happens before first publish (ADR-0005).
