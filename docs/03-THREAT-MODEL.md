# Argus — Threat Model

> Status: `DRAFT v0.1` · Method: STRIDE-lite applied to Argus itself.
> A tool that yells at you about trust must be impossible to fool, and must not become a trust oracle for attackers.

---

## 1. Trust Statement

Argus consumes **read-only public data** (npm registry, GitHub API, OSV.dev).
Argus never executes scanned code (W1 — hard boundary enforced in PRD).
Argus's *output* is advisory; exit codes gate pipelines, but humans see evidence.

## 2. Assets

| ID | Asset                                    | Owner | Impact if compromised                          |
|----|------------------------------------------|-------|-------------------------------------------------|
| A1 | Verdicts/evidence correctness            | user  | False "SAFE" → user pwns themselves (critical)  |
| A2 | Cache store integrity                    | Argus | Poisoned cache → permanent false verdicts       |
| A3 | Provider tokens (GITHUB_TOKEN optional)  | dev   | Token leak → attackers pivot into user's GitHub |
| A4 | Dashboard/API (v1 local loopback)        | dev   | Feeds manipulated later in dashboard surface    |
| A5 | Argus's own supply chain (its repo)      | public| Someone clones malicious "Argus" copy           |

## 3. STRIDE-lite matrix

| ID  | Threat                                                             | STRIDE    | Likelihood | Impact | Mitigation (design-level, enforced by tests)                                  |
|-----|--------------------------------------------------------------------|-----------|------------|--------|--------------------------------------------------------------------------------|
| T1  | Token/credential exposure via logs/error traces                    | Info. Disc| High       | High   | `logTokens()` scrubbing in connect layer; unit test asserts no header/digest echoes |
| T2  | Repudiation: "Argus said it was safe"                              | Repudiation| High      | Medium | Verdicts always ship evidence chain + provider snapshot hash (NFR5 reproducibility) |
| T3  | Denial of service: one provider outage stalls/serial-spins the CLI | DoS       | High       | Low    | Per-provider timeouts, circuit-break promises, scan continues on partial data (NFR3) |
| T4  | Elevation: attacker fools Argus into "SAFE" by eating rate limits   | Elevation | Low        | High   | Cache must record provider digests; digest mismatch → result deleted, eager re-fetch   |
| T5  | Phishing/typosquat of Argus itself on npm                           | Spoofing  | Medium     | Medium | ADR: two-factor publish + GitHub provenance; npm provenance verification in payload    |
| T6  | Tampered dynamic imports / malicious lifecycle                      | Tampering | Low        | Severe | Zero runtime deps (hard guarantee); lifecycle scripts forbidden in our own dev tooling  |

## 4. Explicit Non-Goals (what Argus does NOT guarantee in v1)

- Argus cannot promise 100% of malicious packages are caught (hallucination-free
  guarantee would be a lie). Argus claims: *reproducible, explainable, current-data verdicts*.
- Argus does not sandbox runtime behavior of installed packages (out of scope — see v2 W1).
- Dashboard is v1-loopback only; TLS/auth etc. appear at v2 with API host stage of ADR-7.
