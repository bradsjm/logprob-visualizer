# Logprob Visualizer

Logprob Visualizer is a local React app and packaged CLI for inspecting token-level log probabilities from OpenAI-compatible chat completion providers. The published package serves the built single-page app locally, opens it in your browser by default, and the browser then talks directly to the configured provider API.

## Features
- Provider-backed model discovery via `GET /models`
- Per-model capability probing before use to check whether `logprobs` are supported
- Streaming chat completions from `POST /chat/completions` with token-by-token logprob analysis
- Interactive transcript tokens with probability coloring, alternative-token tooltips, and regenerate support
- Analysis panel with probability chart, usage stats, raw JSON view, and JSON/CSV export
- URL-backed model and generation parameters for shareable local state

## Security Model
- API keys are stored in `localStorage` in the current browser profile.
- Provider requests go directly from the browser to the configured base URL.
- The packaged Node runtime serves static files only. It does not proxy provider requests or hide credentials.

## Prerequisites
- Node.js 20 or newer
- An OpenAI-compatible provider that exposes `GET /models` and `POST /chat/completions`
- A model that returns `logprobs` data for chat completions

## Getting Started
Run the published package:

```bash
npx @bradsjm/logprob-visualizer
```

The CLI starts a local static server on `http://127.0.0.1:8080` by default and attempts to open your default browser. In the app, open `Connection Settings`, enter an API key, and optionally set a base URL.

A blank base URL resolves to `https://api.openai.com/v1`.

## CLI Options
- `--host <address>`: bind address for the local static server. Default: `127.0.0.1`
- `--port <number>`: bind port for the local static server. Default: `8080`
- `--no-open`: do not open a browser automatically
- `--help`: print CLI help

Examples:

```bash
npx @bradsjm/logprob-visualizer --port 9000
npx @bradsjm/logprob-visualizer --host 0.0.0.0 --no-open
```

## Repository Development

```bash
pnpm install
pnpm dev
```

Useful commands:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite dev server on `0.0.0.0:8080` |
| `pnpm build` | Build the production SPA into `dist/` |
| `pnpm build:dev` | Build with development-mode sourcemaps |
| `pnpm preview` | Preview the production build locally |
| `pnpm start` | Run the packaged CLI/static server against `dist/` |
| `pnpm typecheck` | Run TypeScript type-checking |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Run ESLint with automatic fixes |
| `pnpm test` | Run Vitest |
| `pnpm pretty` | Run Prettier on JS/TS/JSON files |
| `pnpm pack --dry-run` | Inspect the publishable package contents |

## Project Structure
- `bin/logprob-visualizer.js`: published CLI entrypoint
- `runtime/server.js`: static file server and CLI argument handling
- `src/pages/Playground.tsx`: main application screen
- `src/features/provider/`: provider HTTP client and streaming/logprob parsing
- `src/features/playground/`: session state and generation parameter management
- `src/components/`: transcript, analysis, composer, settings dialog, and UI primitives
- `src/lib/transport/stream.ts`: browser transport for streaming completions

## How It Works
- Connection settings are read from and written to browser `localStorage`.
- Model discovery fetches `${baseUrl}/models` after a key is saved.
- Selecting a model triggers a small non-streaming probe request to verify `logprobs` support.
- Sending a prompt starts a streaming `chat/completions` request with `logprobs: true` and `stream_options.include_usage: true`.
- The client parses server-sent events in the browser, accumulates token probabilities, and renders the transcript and analysis views progressively.

## Quality Gates
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Contributing
Consult `AGENTS.md` before opening a pull request.
