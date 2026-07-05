# Product/UX/SEO Agent Runbook

Use this agent route when the WhiteS task changes product priority, user flow, visual design, SEO, public distribution, or the 2-month plan.

## Read First

1. `docs/CURRENT_STATUS_RU.md`
2. `docs/AGENT_PLAN_2M_RU.md`
3. `docs/PRODUCT_UX_SEO_COMMISSION_RU.md`
4. `docs/WORKFLOWS_AND_SKILLS_RU.md`
5. `docs/CONSILIUM_AND_DEVELOPMENT_PLAN_RU.md`

For implementation slices also read:

- UX/design: `docs/UX_PRODUCT_PLAN_RU.md`, `docs/SERVICE_DESIGN_AUDIT_PLAN_RU.md`
- SEO/growth: `docs/GROWTH_STRATEGY_RU.md`, `public-lite/sitemap.xml`, `public-lite/robots.txt`, `public-lite/share.php`, `public-lite/api/og.php`
- Data/moderation: `docs/PUBLIC_DATA_CONTRACT.md`, `docs/MODERATION_RU.md`
- Release: `docs/DEPLOY_STATUS_RU.md`, `docs/PUBLIC_LITE_DEPLOY_RU.md`

## Role Checklist

- Product: does the change improve `view -> understand -> report/confirm -> share`?
- UX: does mobile 390px remain usable under stress?
- Visual design: does it preserve the dark system and readable contrast?
- SEO: is every indexed page based only on safe published aggregates?
- Trust/safety: does it avoid PII, exact locations, risky instructions and trackers?
- Data/moderation: can the public output be validated and rolled back?
- Infra/release: can it ship as a small release with tests and live-smoke?

## Current Priority Order

1. Aggregate confirmations into the public export.
2. Add privacy-safe event counters.
3. Run mobile form/list clarity gate before new inbound SEO traffic.
4. Define the regional page safety spec.
5. Generate `/r/<region-slug>/` pages, sitemap and JSON-LD.
6. Consider embed/media only after trusted region pages and metrics exist.

## Required Skills

- `whites-project`: mandatory router for every WhiteS task.
- `playwright`: visual QA, SEO page smoke, mobile/desktop screenshots.
- `security-best-practices`: only for explicit JS/PHP security review.
- `skill-creator`: use if the project decides to split this route into dedicated local skills.

## Workflow

1. Name the slice and the user outcome.
2. Pick the dominant workflow: UX, SEO, data/moderation, release, or incident.
3. Run the commission checklist and record vetoes.
4. Implement only the smallest useful slice.
5. Add or update tests for the slice.
6. Run relevant gates.
7. Update docs and deploy status.
8. Commit and push.

## Gates

- JS/SW changed: `node --check public-lite\app.js`, `node --check public-lite\sw.js`.
- Public data touched: `scripts/validate-public-data.ps1` and safety audit.
- Visible UI touched: Playwright screenshots at 390x844 and 1440x900.
- SEO touched: verify canonical, OG, JSON-LD, robots, sitemap, no raw/pending data, no per-report/share/API/admin URLs in sitemap.
- OG/embed touched: treat as public publication and run the same safe-field review as HTML.
- PHP touched: syntax-check changed `public-lite/api/*.php`, `public-lite/admin/*.php`, `public-lite/share.php`.
- Deployable assets touched: bump version/cache, deploy, live-check.

## Anti-Goals

- No new frontend framework.
- No landing page replacing the tool.
- No exact-address or person-level SEO.
- No external trackers, cookies, ad pixels or registration.
- No auto-publish/auto-reject for safety-sensitive data.
- No Web Push, Mini App or auto-channel posting before live metrics justify them.
- No large multi-week branch without production checkpoints.
