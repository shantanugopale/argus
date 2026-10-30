# Argus — Product Requirements Document

> Status: `DRAFT v0.1` · Owner: Shantanu Gopale · Reviewers: eng
> Pre-implementation artifact. Code starts only after this document is approved.

---

## 1. Problem Statement

Vibe-coders and developers install viral packages/repos at near-zero friction:

- AI assistants recommend npm packages that **do not exist** or are typosquats ("slopsquatting").
- Hijacked-maintainer attacks (`chalk`/`debug`-class incidents) propagate within **hours**.
- Viral repos are clone/paste traps, not build systems.
- Existing tools (`npm audit`, Snyk, Socket.dev) run **after** the developer already
  decided to install, or do not surface "what's trending right now AND is it safe right now".

**The gap:** nobody fuses real-time *virality detection* with real-time *supply-chain
risk verification* into one pre-install gate.

## 2. Vision

A guardian layer between the developer's finger and `Enter`. Argus watches what the
ecosystem is installing/trending, scans it, and answers one question in <3 seconds:

> "Should I trust this thing at **this exact moment** — and why not?"

## 3. Positioning (differentiation matrix)

| Capability                       | npm audit | Snyk | Socket.dev | **Argus** |
|----------------------------------|-----------|------|------------|-----------|
| Known CVEs (OSV/NVD)             | ✅        | ✅   | ✅         | ✅        |
| Behavioral/malicious-code signals| ❌        | ⚠️   | ✅         | ✅        |
| Trending/viral velocity tracking | ❌        | ❌   | ⚠️ (partial)| ✅ **core** |
| Fresh-hijack anomaly (publish age vs. download spike) | ❌ | ❌ | ❌ | ✅ **core** |
| Vibe-coder slopsquatting warnings| ❌        | ❌   | ❌         | ✅        |
| Explainable "why flagged" evidence chain | ❌ | ⚠️ | ✅        | ✅ (prompt-engineered for scan reports) |
| Pre-install CLI gate             | ❌        | ✅   | ✅         | ✅        |

## 4. Personas

1. **Vibe Coder (primary)** — pastes AI output, runs `npm i` without reading anything.
   Needs: one command, instant verdict, plain-language reasons.
2. **Professional Developer** — wants CVE parity + CI integration + exit codes for pipelines.
3. **DevSecOps / Team Lead (later)** — wants a feed/dashboard of risky viral packages org-wide.

## 5. Functional Requirements (MoSCoW)

### Must (v1)
- FR1 `scan npm:<pkg>` — analyze an npm package version: verdict + evidence.
- FR2 `scan gh:<owner>/<repo>` — analyze a GitHub repo's security posture + its npm deps.
- FR3 `trend` — list currently trending/spiking npm packages + GitHub repos with risk overlays.
- FR4 Signal engine with **explainable evidence chain** (every verdict itemized, deterministic).
- FR5 Known-vulnerability resolution via OSV.dev.
- FR6 CLI exit codes (0 safe / 10 review / 20 dangerous) for CI/CD usage.
- FR7 Local HTTP dashboard: trending feed, scan results, evidence drill-down.

### Should (v1.x)
- FR8 `watch` — periodic trend sweep, notifies on new high-risk viral packages.
- FR9 Dependency-graph deep scan (transitive risk propagation).
- FR10 Scan result caching with TTL + integrity-hashed fixture replay.

### Could (v2)
- FR11 AI-assistant hook ("mcp" server interface).
- FR12 Third-party signal providers (Socket API, HuggingFace model cards).
- FR13 Org mode: team feeds, Slack/Telegram/webhook dispatch.

### Won't (ever — trust boundary)
- W1 No executing package code during static analysis.
- W2 No collection of developer identity or scan-target telemetry without opt-in.
- W3 No "security theater": never show a score without the evidence that produced it.

## 6. Non-Functional Requirements (SLO-level)

| ID  | Attribute       | Requirement                                                             |
|-----|-----------------|-------------------------------------------------------------------------|
| NFR1| Latency         | Cached scan p95 < 300 ms; cold scan p95 < 3 s (network-dependent providers) |
| NFR2| Determinism     | Same inputs → identical verdict, byte-identical evidence ordering        |
| NFR3| Resilience      | Mediator/provider outage degrades to cached/partial — never hard-fails a scan |
| NFR4| Rate-limit honor| All connectors: backoff, ETag reuse, per-provider token buckets           |
| NFR5| Auditability    | Every verdict reproducible from recorded provider fixtures               |
| NFR6| Portability     | Node ≥ 22, zero runtime dependencies, single-source CI gate              |
| NFR7| Testability     | Engine = pure functions; providers = interface-adapters; ≥ 90% engine branch coverage |

## 7. Success Metrics (v1)

- Scan correctness vs. hand-labeled corpus of 100 known-bad + 100 known-good packages: ≥ 85% precision, ≥ 70% recall.
- Median time-to-flag a simulated fresh-hijack scenario < 15 min from publish.
- Zero false-positive blocking on top-100 npm packages (defense-in-depth scoring review before v1 publish).
