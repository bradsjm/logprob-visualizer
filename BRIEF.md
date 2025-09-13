# 💡 Lovable App Prompt: Logprob Visualizer

I want to build a **chat-style web app** that helps **prompt engineers, ML researchers, and product teams** explore **token-level probabilities** from OpenAI Chat Completions. It should feel **snappy, educational, and accessible**, and be optimized for **desktop web (responsive to tablet/mobile)**.

---

### Project Name:

**Logprob Visualizer**

---

### Target Audience:

- Prompt engineers and LLM tinkerers
- ML researchers & data scientists
- Product teams validating AI UX and uncertainty

---

### Core Features and Pages:

#### ✅ Homepage

- Hero explaining “See your completion, token by token.”
- CTA to “Start a run” that jumps to the chat workspace.
- Model picker preview + quick explanation of logprobs & top alternatives.

#### ✅ Chat Workspace (Transcript + Composer)

- Left panel shows conversation bubbles:

  - **User bubbles** (neutral surface).
  - **Assistant bubbles** rendering **token-level heatmap text** (one `<span>` per token).

- **Composer** docked at bottom with:

  - Multiline input, **Cmd/Ctrl+Enter** submit.
  - **Parameter drawer** (temperature, top-p, top-k\*, penalties, max tokens, top alternatives).
  - **Per-run badges** showing selected params.

- **Branch badge** appears when branching is active (with “×” to cancel).

#### ✅ Token Heatmap Rendering

- Color mapped from **logprob quantiles** (domain `[q05,q95]` clamped to `[-20,0]`, fallback `[-10,0]`).
- **Default palette:** red `#d73027` → yellow `#fdae61` → light-green `#a6d96a` → green `#1a9850`.
- **Non-color cue**: dashed underline for low-prob tokens.
- Preserves whitespace/newlines (`white-space: pre-wrap`).

#### ✅ Edge-Aware Tooltips (w/ Alternatives)

- Hover to show; click to **pin**; `Esc` to close; tokens focusable by keyboard.
- Shows token, prob %, logprob, and **Top-N alternatives** (sorted by prob).
- Auto-flip/offset to **avoid covering** the token.
- Footer “Showing top N of M” when truncated.
- **Click any alternative** to start a **branch**.

#### ✅ Click-to-Branch

- Clicking the observed token or any alternative:

  - Build exact **prefix** = `concat(tokens[0..i-1]) + clickedAlt` (uses returned token strings).
  - **Prefill composer** with `basePrompt + prefix`.
  - Show **Branch badge** (“Branched at token #i with `<visible>`”).
  - On submit, send `force_prefix` to server (assistant-prefix by default; “hint” mode toggle in Settings).

#### ✅ Analysis Panel (Right)

- **Interactive line chart** (Recharts): y=logprob, x=token index.
- Hover syncs with tokens; clicking a point **scrolls to token** in text.
- Stats: usage tokens, finish_reason, latency; collapsible **raw JSON**.

#### ✅ Models & Capabilities

- `GET /api/models` lists allowed models and whether `top_k` is supported.
- UI **auto-disables** `top_k` when unsupported.
- Enforces **visual caps**: default 128, hard cap 256 completion tokens; **top alternatives ≤ 10**.

#### ✅ Errors & Empty States

- If model lacks logprobs: disable Generate and show guidance to pick a supported model.
- Token cap exceeded: clamp and show “Clamped to 256”.
- Network/API issues: retry/backoff and clear user-readable toasts.

#### ✅ Accessibility & Themes

- **Light/Dark/High-contrast** themes; **color-blind palette** option.
- Full keyboard navigation for tokens/tooltips; ARIA roles/labels.
- WCAG AA contrast; non-color cues.

---

### Tech Stack (Recommended Defaults):

- **Frontend:** Vite, TypeScript, React, shadcn/ui components, Tailwind CSS
- **Charts:** Recharts
- **Backend & Storage:** Next.js API routes or Express on Node; **Supabase (optional)** for rate-limit counters/usage logs (no long-term content storage by default)
- **Auth:** None by default; optional email/password (Supabase Auth) if you later add saved sessions
- **OpenAI:** Official Node SDK; server-side API key only

---

### Design Preferences:

- **Font:** Inter
- **Colors:**

  - Primary: `#1a9850` (ties to high-prob end of palette)
  - Accent: `#6366F1` (indigo for controls/focus)
  - Backgrounds: clean white and soft grays; dark mode equivalents

- **Layout:** Two-column workspace on desktop; collapsible right panel on small screens; mobile-first, card-based panels with generous whitespace

---

### Optional AI Feature (if requested):

- “**Explain this spike**” helper: select a low-prob region and generate a short, educational explanation (e.g., style shift, rare token, punctuation) with suggestions for prompt tweaks.

---

### Implementation Notes for Lovable Scaffolding:

- **API Endpoints**

  - `POST /api/complete`

    - Request: `{ messages, model, temperature, top_p, top_k?, presence_penalty, frequency_penalty, max_tokens (1–256), top_logprobs (1–10), force_prefix?, continuation_mode? }`
    - Server:

      - Validate/clamp ranges; strip unsupported params (e.g., `top_k`).
      - If `force_prefix` and `assistant-prefix`, append `{role:"assistant", content: force_prefix}` to `messages`; else build “hint” prompt.
      - Call OpenAI with `logprobs: true` and `top_logprobs`.
      - If no token logprobs returned → **409** with guidance.

    - Success: `{ text, tokens:[{ index, token, logprob, prob, top_logprobs:[{token,logprob,prob}] }], finish_reason, usage, model, force_prefix_echo? }`

  - `GET /api/models` → list allowed models + `supportsTopK: boolean`

- **Client Types**

  - `Alt`, `TokenLP`, `CompletionLP`, `BranchContext` as defined in spec.

- **Performance**

  - Virtualize token DOM >200 tokens (react-window).
  - Memoize quantiles and color scales per result.
  - Batch tooltip measurement/position with `requestAnimationFrame`.

---

### Pages / Components to Scaffold:

- `ChatTranscript`, `Composer`, `ControlsDrawer`, `TokenText`, `TokenTooltip`, `LogprobChart`, `Legend`
- Settings modal (theme, palettes, continuation strategy)
- Models picker (header)
- Simple `/api/complete` and `/api/models` handlers

---

### Acceptance Criteria (Condensed):

- Chat layout with **bottom composer**; per-run parameter badges.
- Heatmap text with token-level coloring; dashed underline for low-prob tokens.
- Edge-aware tooltips that never obscure the source token; clickable alternatives.
- **Click-to-Branch** prefills composer with exact prefix; badge visible; submit continues from prefix.
- Chart hover sync + click-to-scroll; stats and raw JSON toggle.
- Caps enforced (≤256 tokens; ≤10 alternatives); unsupported params auto-disabled.
- Smooth interactions with WCAG AA contrast and full keyboard support.

# 💡 Design Guidelines for Logprob Visualizer

## 1. General Design Overview

**Purpose:** A chat-style web app that makes token-level probabilities from OpenAI Chat Completions explorable and comparable—fast, educational, and trustworthy.

**Tone & Personality:** Analytical yet friendly; precision tools with a workshop vibe. Clean, spacious, and focused—never gimmicky.

**User Goals:**

- Inspect completions token-by-token to understand certainty and alternatives.
- Branch from any token to test hypotheses quickly.
- Compare model behavior and parameters without friction.
- Capture key stats (usage, latency, finish reason) and inspect raw JSON.

**Overall Feel:**

- Desktop-first, responsive to tablet/mobile.
- Two-column workspace (transcript left, analysis right).
- Lightweight motion, instant feedback, and clear visual mapping from text → probabilities → alternatives.

### 1.1 Core Design Principles

- **Clarity first:** The token → logprob → alternative mapping is always visible and legible.
- **Direct manipulation:** Hover, click, and keyboard controls directly act on tokens and parameters.
- **Speed as UX:** Virtualized lists, batched updates, and optimistic UI where safe.
- **Accessibility by default:** Keyboard-first navigation, WCAG AA contrast, non-color cues.
- **Educate in context:** Inline legends, micro-copy, and explainers that don’t interrupt flow.

---

## 2. Color Scheme

Use the app brand colors **alongside** the logprob heatmap palette. Maintain WCAG AA across themes.

**Brand/UI Colors**

- **Primary (actions, positive emphasis):** `#1A9850` — primary buttons, success states, selected chips.
- **Accent (focus & active controls):** `#6366F1` — focus rings, toggles, links, active tabs.
- **Neutral Light Theme:**

  - Background: `#FFFFFF`
  - Surface: `#F7F7F8`
  - Border: `#E5E7EB`
  - Text Primary: `#111827`
  - Text Secondary: `#4B5563`

- **Neutral Dark Theme:**

  - Background: `#0B0E11`
  - Surface: `#12161A`
  - Border: `#27303A`
  - Text Primary: `#F3F4F6`
  - Text Secondary: `#9CA3AF`

- **High-Contrast Theme:**

  - Background: `#000000`
  - Surface: `#0A0A0A`
  - Text: `#FFFFFF`
  - Accent: `#00FFFF` (focus) + `#FFFF00` (alerts)

**Token Heatmap (Default)**

- **Gradient (low → high probability):**

  - Red `#D73027` → Yellow `#FDAE61` → Light-Green `#A6D96A` → Green `#1A9850`.

- **Mapping:** Logprob quantile domain `[q05, q95]` clamped to `[-20, 0]` with fallback `[-10, 0]`.
- **Non-color cue:** Low-prob tokens also receive a **dashed underline**.

**Color-Blind Palette (toggle)**

- Orange `#F28E2B` → Light `#FFBE7D` → Teal `#59A14F` → Deep Teal `#2CA02C`.

---

## 3. Typography

### 3.1 Font Family

- **Primary:** Inter (system fallback: `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`).
- **Monospace (data, tokens, JSON):** `ui-monospace`, `SFMono-Regular`, `Menlo`.

### 3.2 Weights & Hierarchy

- **H1:** Inter 800
- **H2:** Inter 700
- **H3:** Inter 600
- **Body:** Inter 400/500
- **Button/Badge Labels:** Inter 600 (all-caps avoided; use Sentence case)

### 3.3 Font Sizes (Mobile-first)

- **H1:** 24–28px (desktop 32–36px)
- **H2:** 20–22px (desktop 28px)
- **H3:** 18px (desktop 20–22px)
- **Body:** 14–16px (desktop 16px)
- **CTA Buttons:** 14–16px
- **Label/Meta:** 12–13px (use ≥ 13px on low-density screens)

---

## 4. UI Components

### Homepage / Dashboard

**Layout:** Split hero (left text, right interactive model picker preview). Sticky global header with model selector and “Start a run” CTA.
**Hero:** “See your completion, token by token.” Subtext explains logprobs & alternatives succinctly.
**Content Blocks:**

- **Model picker preview:** Choose model and see whether `top_k` is supported; inline hint on logprobs.
- **Quick explainer cards:** “What’s a token?”, “What are logprobs?”, “Branching 101” (3 cards, 2–3 lines each).
  **Interactions:** “Start a run” jumps into the Chat Workspace with parameters prefilled.

### Chat Workspace (Transcript + Composer)

**Layout:**

- **Left panel:** Conversation bubbles; assistant messages render token heatmap text (one `<span>` per token).
- **Bottom composer (docked):** Multiline input; **Cmd/Ctrl+Enter** submit.
- **Parameter drawer:** Temperature, top-p, top-k\*, penalties, max tokens, top alternatives.
- **Badges row:** Per-run parameter badges; **Branch badge** when active with “×” to cancel.
  **Behaviors:**
- Virtualize token DOM >200 tokens.
- Preserve whitespace/newlines (`white-space: pre-wrap`).
- Unsupported `top_k` auto-disabled with tooltip (“Not supported by current model”).

### Detail Page: Token & Alternatives (in-context via Tooltip)

**Purpose:** Edge-aware tooltip acts as the “detail view,” pinned on click or keyboard focus.
**Content:** Token string, prob %, logprob; **Top-N alternatives** sorted by prob; footer “Showing top N of M” when truncated.
**Edge Awareness:** Tooltip flips/offsets to avoid covering the source token; collision detection with viewport and container edges.
**Actions:** Clicking an alternative or the token starts a **branch**.

### Action Flow: Click-to-Branch

**Flow:**

1. Click observed token or an alternative.
2. App computes **prefix** = `concat(tokens[0..i-1]) + clickedAlt` (using returned token strings).
3. Composer is prefilled with `basePrompt + prefix`.
4. **Branch badge** appears: “Branched at token #i with ‘<visible>’”.
5. On submit, send `force_prefix` (assistant-prefix by default; “hint” mode toggle in Settings).
   **UX Details:**

- Badge includes dismiss “×”.
- Add subtle breadcrumb chip to show lineage when multiple branches exist.
- Distinguish branches in transcript with a thin left rail accent color.

### Analysis Panel (Right)

**Layout:** Collapsible panel; on desktop shows by default; on tablet/mobile collapsed with a chevron handle.
**Content:**

- **Interactive line chart** (y=logprob, x=token index) with hover sync to token spans.
- **Stats block:** usage tokens (prompt/completion), finish_reason, latency.
- **Raw JSON** collapsible viewer (monospace, soft grid background).
  **Interactions:**
- Hover on chart highlights the token; clicking scrolls token into view and pins tooltip.
- Keyboard focus syncs chart and text.

### Profile / Settings

**Sections:**

- **Theme & Accessibility:** Light/Dark/High-contrast; **Color-blind palette** toggle; reduced motion.
- **Models & Caps:** Visual caps (default 128, hard 256); set default Top-N ≤ 10.
- **Continuation strategy:** assistant-prefix vs “hint” mode.

---

## 5. Mobile UX & Accessibility

- **Navigation:** Bottom sheet for Parameters; right Analysis panel becomes a slide-over.
- **Tap targets:** Minimum 44×44px.
- **Scrolling:** Keep composer docked; transcript uses anchor scrolling to selected token; ensure `prefers-reduced-motion` respected.
- **Contrast:** All text and interactive elements meet **WCAG AA** (ensure token underlines remain visible in all themes).
- **Keyboard:**

  - **Tab** moves across tokens; focused token shows a 2px **indigo** `#6366F1` focus ring.
  - **Enter** on focused token opens/pins tooltip; **Esc** closes.
  - **Cmd/Ctrl+Enter** submits.

- **ARIA:**

  - Tokens: `role="button"` + `aria-describedby` linking to tooltip when open.
  - Tooltips: `role="dialog"` with labelled token content.
  - Toasts: `aria-live="polite"`; errors `assertive`.
  - Chart: provide text summary (range, min/max) and keyboard exploration.

---

## 6. Icons & Visual Style

- **Icon set:** Lucide for consistency and clarity (thin, geometric).
- **Icon colors:** Neutral by default; adopt **Accent** on active/focus.
- **Illustration:** Minimal, line-based diagrams for Homepage explainers; avoid mascots.
- **Screenshots/GIFs:** Short, looped micro-demos (branching, tooltip pinning).
- **JSON & Data:** Subtle code-block backgrounds with faint grid for structure.

---

## 7. Microinteractions & Animations

- **Page transitions:** Subtle **fade/slide-up** on Workspace load (120–180ms).
- **Token hover:** 80ms background tint + underline emphasis; pinned state adds gentle shadow.
- **Tooltip:** Scale-in from token with spring (overshoot < 1.02), edge-aware repositioning; **Esc** animates out.
- **Chart hover:** Crosshair + synchronized token highlight; click pulse on data point.
- **Badges:** Parameter/Branch badges slide-in from bottom with 120ms ease; dismiss with slide-down.
- **Toasts:** Non-blocking, stack at top-right; clear language (“Clamped to 256 tokens”).

---

## 8. Performance Considerations

- **Virtualization:** Token spans and long transcripts via react-window; overscan tuned for smooth scrolling.
- **Memoization:** Precompute quantiles, color scales, and dashed-underlines once per result; cache per run.
- **Batching:** Tooltip measurement and scroll sync with `requestAnimationFrame`.
- **Lazy loading:** Charts and JSON viewer load on first open; model list cached.
- **Assets:** SVG for icons; defer non-critical illustrations; `prefers-reduced-data` consideration.
- **Client types:** Strong typing for `Alt`, `TokenLP`, `CompletionLP`, `BranchContext` for low-cost rendering diffs.

---

## 9. Security & Privacy Design

- **API key:** Server-side only; never exposed to client.
- **Rate limiting:** IP-based (e.g., 30 req/min) with user-readable errors and retry/backoff.
- **Data handling:** No prompt/completion logging by default; optional local debug toggle with clear on/off indicator.

---

## 🔄 Conclusion

Logprob Visualizer delivers an **empowering, comprehensible** window into token-level behavior—bridging raw probabilities with intuitive visuals and seamless branching. The design prioritizes **clarity, speed, and accessibility**, wrapping expert functionality in an interface that welcomes exploration. By aligning brand colors with the heatmap palette, enforcing parameter caps visibly, and providing rich yet unobtrusive education, the product fosters trust and accelerates learning for prompt engineers, researchers, and product teams alike.

---

### Appendix: Acceptance Criteria Alignment (Quick Check)

- Chat layout with bottom composer + **per-run badges** ✅
- Heatmap text with **quantile-mapped color** + **dashed underline** ✅
- **Edge-aware tooltips** with Top-N alternatives; pin/esc/keyboard ✅
- **Click-to-Branch** with exact prefix, prefilled composer, visible badge ✅
- **Chart hover sync** + click-to-scroll; stats + raw JSON toggle ✅
- Caps enforced (≤256 tokens; ≤10 alternatives); unsupported params auto-disabled ✅
