# Logprob Visualizer

Logprob Visualizer is a self-contained npm demo for exploring token-level log probabilities from OpenAI-compatible chat models. `npx @bradsjm/logprobs-viewer` starts a local web server, opens the browser, serves the built SPA, and the app then talks directly to the configured provider from the browser.

## Security Model
- API keys are stored in `localStorage` in the current browser profile.
- Requests go directly from the browser to the configured provider.
- This improves deployment simplicity and user control, but it is less secure than a trusted backend.

## Prerequisites
- Node.js 20
- A provider that exposes OpenAI-compatible `GET /models` and `POST /chat/completions` endpoints

## Getting Started
1. Run `npx @bradsjm/logprobs-visualizer`
2. The package starts a static web server on `http://127.0.0.1:8080` and opens your default browser.
3. Use `Connection Settings` to save an API key and optional base URL.

Blank base URL defaults to `https://api.openai.com/v1`.

CLI options:
- `--port <number>`
- `--host <address>`
- `--no-open`

Examples:
- `npx @bradsjm/logprobs-viewer --port 9000`
- `npx @bradsjm/logprobs-viewer --host 0.0.0.0 --no-open`

## Repository Development
- `pnpm install`
- `pnpm dev` for the Vite dev server
- `pnpm start` for the packaged static server
- `pnpm build` before `pnpm pack --dry-run` or publishing

## How It Works
- The app loads models from `${baseUrl}/models`.
- When you select a model, it performs a minimal non-streaming probe to verify that `logprobs` are supported.
- Streaming generation uses `${baseUrl}/chat/completions` directly from the browser and progressively renders token deltas plus top alternatives.
- The bundled Node runtime only serves static files and SPA route fallbacks. It does not proxy model requests or hide credentials.

## Quality Gates
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm pack --dry-run`

## Contributing
Consult `AGENTS.md` before opening a pull request.
