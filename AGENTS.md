# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React client entrypoints and shared styling. `src/App.tsx` wires React Query, routing, tooltips, and toasts, and `src/main.tsx` mounts the app.
- `src/pages` holds routed screens. The app currently has `Playground.tsx` for the main UI and `NotFound.tsx` for unmatched routes.
- `src/components` contains UI building blocks and composite view components such as the transcript, analysis panel, composer, model selector, and connection settings dialog. Reusable primitives live under `src/components/ui`.
- `src/features/playground` contains session state, run-parameter state, and playground-specific types. `src/features/provider` contains provider client code, query keys, and SSE/logprob parsing.
- `src/hooks` contains shared React hooks for connection settings, model discovery, capability probing, and debouncing. `src/lib` contains cross-cutting helpers such as connection storage and the browser streaming transport.
- `src/types` defines shared transport, connection, and logprob types. Static assets live in `public/`. The packaged CLI lives in `bin/`, the static file server lives in `runtime/`, and production build output lands in `dist/`.

## Build, Test, and Development Commands
- `pnpm dev` starts the Vite development server on `0.0.0.0:8080`.
- `pnpm build` creates the production SPA bundle in `dist/`. `pnpm build:dev` builds with development-mode sourcemaps.
- `pnpm preview` serves the Vite production build for local verification.
- `pnpm start` runs the packaged CLI entrypoint in `bin/logprob-visualizer.js`, which serves `dist/` through `runtime/server.js`. Pass CLI flags after `--`, for example `pnpm start -- --port 9000 --no-open`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm lint:fix`, and `pnpm pretty` are the primary quality commands. `pnpm prepack` runs `pnpm build`.

## Coding Style & Naming Conventions
- TypeScript is the source of truth. Keep domain types in `src/types` or the closest feature module and avoid `any`.
- Components use PascalCase filenames, hooks use the `useX` pattern, and shared helpers should stay close to the feature that owns them before being promoted into `src/lib`.
- Use the `@` alias for `src` imports. Preserve the existing React Query, React Router, and Tailwind-based structure instead of introducing parallel patterns.
- Run parameters are normalized in `src/features/playground/lib/runParameters.ts`, connection persistence is centralized in `src/lib/connection.ts`, and provider HTTP behavior belongs under `src/features/provider`.

## Testing Guidelines
- Vitest runs both browser-style tests in `jsdom` and Node-side tests such as `runtime/server.test.ts`. Keep tests near the code they cover when practical.
- Add or update `*.test.ts` and `*.test.tsx` files when behavior changes in hooks, transport logic, runtime server behavior, or interactive UI flows.
- For substantive changes, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Use `pnpm preview` or `pnpm start` for a manual smoke test when the change affects shipped behavior.

## Commit & Pull Request Guidelines
- Use Conventional Commits in the existing `type(scope): message` style.
- PRs should state the concrete problem, the source-grounded solution, and the user-visible impact. Include screenshots or clips for UI changes.
- Call out breaking changes explicitly and record which quality checks were run.

## Security & Configuration Tips
- Provider credentials are stored in browser `localStorage` under the connection settings key defined in `src/lib/connection.ts`. Changes to that client-side storage model require explicit review.
- The browser calls the configured provider directly at `${baseUrl}/models` and `${baseUrl}/chat/completions`. A blank base URL resolves to `https://api.openai.com/v1`.
- `runtime/server.js` is a static file server with SPA fallback behavior. Do not add request proxying, credential injection, or server-side provider access unless explicitly requested.
