# DreamRO

Browser single-player RO-style RPG (character, maps, combat) on Three.js.
Profile: ts-worker-web
Direction: [docs/gameplay.md](docs/gameplay.md). Frameworks must not rewrite this file.

## Sources of Truth

This file is the **contract**. Hooks, CI, and config are **enforcement**. If they disagree, that is a failure — raise enforcement to match this file; never lower the contract to a weaker hook.

| Fact | Where |
|---|---|
| Agent handbook | this file |
| Human docs | README.md, `docs/*.md`, CREDITS.md |
| Version | `package.json` `"version"` as `1.2.3`, display `v1.2.3` |
| Enforcement | `.github/workflows/ci.yml` (base-ci test-job), `playwright.config.ts` |
| Machine rules | global `AGENTS.md`, `rules/git-commit.md` |
| Accidents | [Retrospective.md](Retrospective.md) |
| Env files | none required |

## Project Invariants

- Game logic and saves stay in the browser (`localStorage` keyed to origin). No accounts or multiplayer.
- Worker (`worker.js`) only rewrites `GET /api/live` to `api/live.json` and otherwise serves Vite assets. Do not add D1 or remote `-test` resources.
- Progress is per origin/browser; clearing site data deletes saves.
- Art/font provenance stays in CREDITS.md; do not drop third-party notices.

## Stack / Layout

| Component | Choice |
|---|---|
| Language | TypeScript (`tsc --noEmit`) |
| Package manager | npm (`package-lock.json`) |
| Runtime | Vite + Three.js; Cloudflare Worker + assets |
| Lint | none in package.json |
| Tests | Playwright only (`npm test` → `tests/*.spec.ts`) |
| Data | none (browser localStorage) |

```
src/  tests/{game,boss}.spec.ts
worker.js  wrangler.jsonc
docs/  public/  scripts/  art/
```

## Commands

```bash
npm install
npm run dev                 # Vite, default :5173; Playwright uses :5188
npm run typecheck           # tsc --noEmit
npm run build               # tsc --noEmit && vite build && scripts/write-build-info.mjs
npm test                    # playwright (L3), webServer `npm run dev -- --port 5188`
npm run preview:worker      # build + wrangler dev --port 8787
npm run deploy:check        # build + wrangler deploy --dry-run
npm run deploy              # build + wrangler deploy (owner only)
npm run verify:release      # scripts/verify-release.mjs
```

There is no `lint` or `test:coverage` script.

## Verification

Status: `enforced` | `planned` | `manual` | `N/A`.
6DQ = L1/L2/L3 + G1/G2 + D1. Required L1 bar is statements/branches/functions/lines each ≥95%; no skipped or focused tests.

| Change | Proof | Status | Evidence |
|---|---|---|---|
| Logic | L1 unit coverage ≥ 95% four metrics | planned | no Vitest/unit suite or coverage config; `npm test` is Playwright |
| API / schema | L2 real HTTP 100% surface | planned | Worker surface is `/api/live` only; no real-HTTP API tests |
| UI path | L3 Playwright | enforced | CI `command: npm test` after build + wrangler dry-run |
| Types / lint | G1 0 error, 0 warning | planned | CI does not run `typecheck`; no lint script; no husky |
| Deps / secrets | G2 osv-scanner + gitleaks | planned | CI uses `test-job.yml`, not quality.yml security |
| Test isolation | D1 fresh browser state on the local test server | planned | Playwright isolates contexts and seeds synthetic CI preferences at loopback :5188. Outside CI, `reuseExistingServer` may reuse the daily server; explicit test-server ownership remains a gap. SQLite/`_test_marker` are N/A because there is no database |
| Bundler output | `npm run build` + wrangler dry-run | enforced | CI `pre-command` |
| Docs | update gameplay/deploy docs if behavior changed | manual | human review |
| Release | version + Worker deploy | enforced | `.github/workflows/release.yml` after green CI |

No husky. Target (unmeasured): pre-commit G1+L1 on index snapshot <30s; pre-push L2+G2 on stdin refs <3min. `--no-verify` forbidden.

## Resources / Isolation

| Purpose | Port / resource | Isolation |
|---|---|---|
| Dev | 5173 Vite (`0.0.0.0`) | local static game |
| L3 | 5188 Playwright webServer | local only |
| Worker preview | 8787 `wrangler dev` | local; never `--remote` |

E2E never touches prod data stores. Do not deploy remote `-test` Workers.

## Operations / Release

- Entry: `npm run deploy` or tag `v*.*.*` → `release.yml`
- Auth: Cloudflare account owner
- Before ship: CI green; live `https://dreamro.hexly.ai`
- Runbook: [docs/deployment.md](docs/deployment.md)

## Retrospective

| Kind | Where |
|---|---|
| Accident narrative | [Retrospective.md](Retrospective.md) |
| Project-specific rule that will recur | one line here (cap ~10) |
| Cross-project lesson | nmem / global `AGENTS.md` / `rules/` |
| Deterministically checkable rule | hook or test, not prose |

- Treat `npm test` as L3, not L1. Do not claim coverage from Playwright specs.
