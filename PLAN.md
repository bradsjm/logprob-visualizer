# Implementation Plan

This plan delivers the Logprob Visualizer in small, reviewable phases. Each phase upgrades visible frontend behavior—from static mocks to live OpenAI-backed features—while keeping the codebase streaming‑ready and the chart visualization swappable.

## Principles
- Type-safe end to end (TypeScript + Zod).
- Non‑streaming first; design for streaming via pluggable transport.
- Clear seams: UI ↔ API client ↔ backend service ↔ OpenAI.
- Swappable chart abstraction with a minimal interface.

## Phase 1 — Static Scaffold (UI Only)
- Frontend: Shell layout (Transcript | Composer | Right Panel). Static example transcript with mock tokens; placeholder chart component; parameter drawer (disabled submit) with a Temperature slider.
- Preset chips: quick parameter presets (e.g., “Deterministic”, “Creative”) that only update local UI state for now.
- Deliverables: Visual layout, token heatmap with placeholder coloring, legends.
- Review: UI structure, responsive layout, themes.

## Phase 2 — Token Heatmap & Tooltips (Mock Data)
- Frontend: Implement `TokenText` with heatmap (quantile → color), dashed underline for low-prob; `TokenTooltip` with pinned/keyboard support; mock Top‑N alternatives.
- Deliverables: Accessible tooltips, hover + pin, keyboard nav.
- Review: A11y checks, WCAG AA contrast.
- One‑click demo: “Try sample run” (mock completion) for instant onboarding without API key.
- Readability toggles: hide/show whitespace and punctuation overlays (visual only).
- Keyboard: shortcuts to focus composer (`/`), open parameters (`.`), and jump next/prev low‑confidence token (`[` `]`).
- Mini legend popover: compact always‑available legend explaining the color scale.

## Phase 3 — Chart Abstraction (Mock Data)
- Frontend: Define `LogprobSeries` interface and `ChartAdapter` (`render(series, onPointClick)`); provide `RechartsAdapter` as default.
- Deliverables: Line chart syncs hover/scroll; adapter swapped via prop for future libraries.
- Review: Chart swap demo using a trivial SVG adapter.
- Hover status: show token index and character offset in a tiny status bar on hover.
- Keyboard on chart: Enter on a focused point scrolls to token (parity with click).

## Phase 4 — Backend Scaffold (Non‑Streaming)
- Backend: Fastify (TypeScript) with Zod validation. Endpoints: `GET /api/models`, `POST /api/complete` (no streaming). Clamp ranges, strip unsupported params, structured errors (409 for missing logprobs).
- Infra: Env `OPENAI_API_KEY`, CORS, pino logging.
- Deliverables: Local API server (`npm run dev:api`).
- Review: Route contracts and sample responses.
- Health endpoint: `GET /api/health` returns { status, uptime, version? }.
- Request‑ID: generate and echo `x-request-id` for traceability; surface in UI on errors.
- Env validation: fail fast with clear message when `OPENAI_API_KEY` missing (zod‑based).
- Mock mode: feature flag to serve canned completions for demos/tests.

## Phase 5 — Connect Models Endpoint
- Frontend: Fetch models from `/api/models` at runtime (no hardcoded list). Show loading skeleton, error state with retry, and cache results in memory; expose a manual refresh.
- URL state (initial): encode model and core parameters in the URL so the picker reflects shared links.
- Deliverables: Param badges reflect active values; Temperature slider visible in header.
- Review: Network error toasts; verify list updates without rebuild.

## Phase 6 — Connect Complete (Non‑Streaming)
- Frontend: API client module (`transport/rest.ts`) returning `CompletionLP`; wire Composer submit with Temperature slider; show usage, finish_reason, latency; raw JSON toggle.
- HUD: show latency and token usage in header chips; copy text and download JSON/CSV for each run.
- URL state (branch): include optional branch token index for shareable repro; add “Fork in new tab”.
- A11y polish: ARIA live announcements for result ready/errors; restore focus to composer on failure.
- Deliverables: Real completions with token heatmap + chart.
- Review: Caps enforced (≤256 tokens; ≤10 alternatives); clamp messages surfaced.

## Phase 7 — Click‑to‑Branch
- Backend: `force_prefix` (assistant-prefix default; hint mode toggle).
- Frontend: Click token/alternative → prefill composer with exact prefix; show branch badge; submit continues from prefix.
- Review: Branching UX and correctness of prefix.

## Phase 8 — Performance & A11y Hardening
- Frontend: Virtualize tokens >200, memoize quantiles/color scales, batch tooltip measurement with `requestAnimationFrame`.
- Deliverables: Smooth interactions under long outputs.
- Review: Keyboard path, screen-reader labels.

## Phase 9 — Streaming‑Ready Refactor (No Behavior Change)
- Frontend: Introduce `Transport` interface: `complete(params): Promise<CompletionLP> | Stream<Partial>`; keep current REST as `RestTransport`.
- Backend: Prepare `/api/complete/stream` route (feature‑flagged, not used yet).
- Deliverables: No UX change; code paths support future streaming with minimal diffs.

## Phase 10 — Tests & Observability
- Unit: color scale, quantile mapping, token DOM mapping, prefix builder.
- Integration: contract tests for clamps and 409 error handling (mock OpenAI).
- Smoke: happy-path manual script.
- Observability: basic request logging + latency stats.
- Visual: lightweight Playwright snapshot of heatmap rendering states.
- Contract: verify `x-request-id` echo and health endpoint.

## Developer Commands (proposed)
- `npm run dev` – Vite frontend.
- `npm run dev:api` – start Fastify server.
- `npm run lint` – ESLint.
- Future: `npm run test` – Vitest suite.

### Concurrent Frontend + Backend
- Install once: `npm i -D concurrently`
- Add script: `"dev:all": "concurrently -k -n WEB,API -c green,cyan \"npm:dev\" \"npm:dev:api\""`
- Run both: `npm run dev:all`

## Exit Criteria per Phase
Each phase merges only when the phase’s “Deliverables” are verifiably visible in the UI or logs, with lint clean and types passing.
