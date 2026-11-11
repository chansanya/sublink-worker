# Repository Guidelines

Contributor guide for **sublink-worker**, a Cloudflare Worker that converts proxy links and subscriptions into Clash, sing-box, and Xray configs, with a static UI and short links.

## Project Structure & Module Organization

- `src/` — Worker ES modules. Entry: `src/index.js` (`export default { fetch }`). Builders, `ProxyParsers.js`, rules in `config.js`, helpers in `utils.js`.
- `public/` — Static UI (`index.html`, `app.js`, `styles.css`, `icons.js`) via Workers Static Assets; other routes hit the Worker.
- `docs/` — Standalone VitePress site (`docs/package.json`). Never place docs under `public/`.
- `scripts/build-icons.mjs` — Regenerates Lucide icons into `public/icons.js`.
- `wrangler.jsonc` — Worker entry, assets, and `SUBLINK_KV` binding (no `id`; wrangler auto-provisions it on deploy).

## Build, Test, and Development Commands

```bash
npm install
npm run dev                 # wrangler dev → http://localhost:8787 (local KV)
npm run deploy              # wrangler deploy (auto-creates SUBLINK_KV on first deploy)
npx wrangler deploy --dry-run
npm run icons               # rebuild icons after editing NAMES in scripts/build-icons.mjs
cd docs && npm install && npm run dev     # VitePress → http://localhost:5173
cd docs && npm run build                  # build docs + check links
```

## Coding Style & Naming Conventions

Use ES modules and 2-space indent. Keep Clash and sing-box group/selector names in sync. Rule catalog belongs only in `UNIFIED_RULES` / `PREDEFINED_RULE_SETS` (`src/config.js`). Intermediate proxy shape is sing-box outbound; Clash goes through `convertToClashProxy`. Pin `js-yaml@4.1.0`. UI icons come from Lucide via `npm run icons`. See `CLAUDE.md` for architecture detail.

## Testing Guidelines

No unit or lint scripts are checked in. Smoke-test with `npm run dev` against `/clash`, `/singbox`, `/xray`, and short links; run `cd docs && npm run build` when docs change. State in the PR what was and was not verified.

## Commit & Pull Request Guidelines

Follow Conventional Commits seen in history: `feat(ui): …`, `fix(docs): …`, `refactor: …`, `ci(pages): …`, `chore: …`. PRs need intent, touched areas (`src` / `public` / `docs` / CI), linked issues, and UI screenshots when the frontend changes. Keep Worker deploy separate from GitHub Pages (`docs/**` → `gh-pages`). Do not commit real KV ids, tokens, or secrets.

## Security & Configuration Tips

`SUBLINK_KV` stores short links only; `handleRequest` is the sole `env` consumer. The binding has no `id`; wrangler (>= 4.45) creates the namespace on first deploy, and local `wrangler dev` uses a simulated KV.
