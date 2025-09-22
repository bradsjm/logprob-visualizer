# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the React client. Favor `src/components` for UI primitives, `src/pages` for routed views, `src/hooks` for stateful logic, and `src/lib` for cross-cutting utilities.
- `server/` runs the Fastify API (`index.ts`) and ships shared model metadata; keep API-only dependencies here.
- Static assets live in `public/`, bundled output lands in `dist/`, and container scripts stay under `docker/` and `scripts/`.

## Build, Test, and Development Commands
- `npm run dev` launches the Vite dev server; pair with `npm run server` or the combined `npm run dev:all` when you need API + UI.
- `npm run build` (or `npm run build:dev`) creates production artifacts; validate with `npm run preview` before shipping.
- `npm run typecheck`, `npm run lint`, `npm run lint:fix`, and `npm run pretty` enforce TypeScript, ESLint, and Prettier baselines.
- `npm run docker:build` and `npm run docker` package and run the app using `.env.local` for runtime configuration.

## Coding Style & Naming Conventions
- TypeScript is the source of truth—avoid `any`, rely on discriminated unions, and extend shared types from `src/types` where possible.
- Components use PascalCase filenames; hooks use the `useX` pattern. Keep exports named and collocate styles with the component.
- Tailwind tokens live in `tailwind.config.ts`; use semantic classes instead of raw colors. Formatting is automated, so run the lint/pretty commands before each PR.

## Testing Guidelines
- No automated tests ship today; when introducing them, place `*.test.ts` or `*.test.tsx` near the module under test and wire them into a Vitest runner.
- Until a suite exists, treat `npm run typecheck`, targeted lint runs, and manual smoke tests via `npm run preview` as mandatory.

## Commit & Pull Request Guidelines
- Follow the established Conventional Commit style (`type(scope): message`) observed in history (e.g., `refactor(tooltip): enhance formatPercent function`).
- PRs must articulate the problem, the solution, and user impact. Attach screenshots or clips for UI-facing changes and list manual verification steps.
- Link tracking issues, surface breaking changes in a dedicated note, and confirm typecheck + lint status in the description before requesting review.

## Security & Configuration Tips
- Secrets belong in `.env.local`; add illustrative keys to `docker/.env.example` when new configuration is required.
- Fastify middleware (CORS, rate limiting) is centralized in `server/index.ts`. Update it there to preserve consistent hardening across environments.
