# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the React client. Favor `src/components` for UI primitives, `src/pages` for routed views, `src/hooks` for stateful logic, and `src/lib` for cross-cutting utilities.
- Static assets live in `public/`, and bundled output lands in `dist/`.

## Build, Test, and Development Commands
- `pnpm dev` launches the Vite dev server.
- `pnpm build` (or `pnpm build:dev`) creates production artifacts; validate with `pnpm preview` before shipping.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm lint:fix`, and `pnpm pretty` enforce TypeScript, ESLint, test, and Prettier baselines.

## Coding Style & Naming Conventions
- TypeScript is the source of truth—avoid `any`, rely on discriminated unions, and extend shared types from `src/types` where possible.
- Components use PascalCase filenames; hooks use the `useX` pattern. Keep exports named and collocate styles with the component.
- Tailwind tokens live in `tailwind.config.ts`; use semantic classes instead of raw colors. Formatting is automated, so run the lint/pretty commands before each PR.

## Testing Guidelines
- Colocate `*.test.ts` or `*.test.tsx` files near the module under test and run them with Vitest.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and manual smoke tests via `pnpm preview` are mandatory for substantive changes.

## Commit & Pull Request Guidelines
- Follow the established Conventional Commit style (`type(scope): message`) observed in history (e.g., `refactor(tooltip): enhance formatPercent function`).
- PRs must articulate the problem, the solution, and user impact. Attach screenshots or clips for UI-facing changes and list manual verification steps.
- Link tracking issues, surface breaking changes in a dedicated note, and confirm typecheck + lint status in the description before requesting review.

## Security & Configuration Tips
- The app stores provider credentials in browser `localStorage`; any change in that behavior requires explicit review because it affects the security model.
- Connection settings live entirely on the client; avoid reintroducing hidden runtime configuration paths unless the user explicitly asks for them.
