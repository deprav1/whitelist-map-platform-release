# Project: WhiteS UX/UI Improvement

## Architecture
WhiteS is a single-page static web application (SPA) located in the `public-lite/` directory.
- **index.html**: The application shell, layout, modal dialogs, and styling links.
- **app.js**: The client-side logic handling Leaflet map setup, data fetching, filtering, local caching, and the multi-step report dialog.
- **styles.css**: The UI styling, layout rules, and responsiveness.
- **vendor/leaflet/**: Local Leaflet assets.
- **sw.js**: (To be implemented) Service Worker for caching the App Shell and assets offline.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Testing Suite | Create E2E test infra and test cases (Tiers 1-4) in `TEST_INFRA.md` and verification scripts | None | IN_PROGRESS (Conv: edf52075-51c9-401c-9385-a8ae0152367d) |
| 2 | UX Improvements (R1) | R1.1: Telegram Deep Link; R1.2: Interactive service pills for popular services | 1 | PLANNED |
| 3 | Service Worker (R1.3) | Offline shell caching via `sw.js` registration and verification | 1 | PLANNED |
| 4 | UI Premium Glassmorphism (R2) | Dark Only, transparent RGBA backgrounds, inset box-shadow, micro-animations, neon markers, customized scrollbar | 1 | PLANNED |
| 5 | E2E verification & hardening | E2E test pass (Tiers 1-4) + Adversarial Coverage Hardening (Tier 5) | 2, 3, 4 | PLANNED |

## Product Roadmap (июль–октябрь 2026)
Стратегический план роста: `ROADMAP.md` (корень). Самодостаточные брифы этапов для агентов:
`.agents/roadmap/README.md` (индекс) + `00-foundation.md` … `04-scale-trust.md`.
Milestones 2–4 выше поглощаются этапами 0–1 роадмапа (R1.1/R1.2 → бриф 01, R1.3/R2 → бриф 00).

## Operating Workflows

Перед новой итерацией использовать `docs/WORKFLOWS_AND_SKILLS_RU.md`. Там закреплены workflow для UX, публичных данных, модерации, деплоя, инцидентов, roadmap и консилиума агентов, а также локальный Codex skill:

```text
C:\Users\Lenovo\.codex\skills\whites-project
```

## Code Layout
- `public-lite/index.html` - HTML core structure and modals.
- `public-lite/app.js` - JS logic, maps, and UI events.
- `public-lite/styles.css` - Custom styles.
- `public-lite/sw.js` - (To be created) Service Worker script.
- `public-lite/vendor/` - Vendor assets (Leaflet, silhouette).
- `scripts/` - Verification and build scripts.

## Interface Contracts
### Service Worker ↔ Application Shell
- SW intercepts requests for `/`, `/index.html`, `/app.js`, `/styles.css`, `/vendor/*` and serves from Cache Storage.
- SW handles update checks during page load.

### Report Form ↔ Telegram Bot
- Form converts inputs to a structured draft string.
- Deep Link: `?text=` не работает для ботов. Рабочие варианты: `https://t.me/WhiteS_Bot?start=<base64url_payload>` (payload ≤ 64 символа) либо `https://t.me/share/url?url=...&text=...`. Итоговую схему выбирает исполнитель брифа `.agents/roadmap/01-report-loop.md` (WP-1.1) и фиксирует здесь.
