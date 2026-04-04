# Logprob Visualizer

Logprob Visualizer is a client-side React app for exploring token-level log probabilities from OpenAI-compatible chat models. It discovers models from the configured provider, probes the selected model for `logprobs` support, and then streams completions directly from the browser.

## Security Model
- API keys are stored in `localStorage` in the current browser profile.
- Requests go directly from the browser to the configured provider.
- This improves deployment simplicity and user control, but it is less secure than a trusted backend.

## Prerequisites
- Node.js 20 and pnpm 10
- A provider that exposes OpenAI-compatible `GET /models` and `POST /chat/completions` endpoints

## Getting Started
1. Install dependencies: `pnpm install`
2. Start the app: `pnpm dev`
3. Open the app, then use `Connection Settings` to save an API key and optional base URL.

Blank base URL defaults to `https://api.openai.com/v1`.

## How It Works
- The app loads models from `${baseUrl}/models`.
- When you select a model, it performs a minimal non-streaming probe to verify that `logprobs` are supported.
- Streaming generation uses `${baseUrl}/chat/completions` directly from the browser and progressively renders token deltas plus top alternatives.

## Quality Gates
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Contributing
Consult `AGENTS.md` before opening a pull request.
