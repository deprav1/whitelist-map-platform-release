# WhiteS — мега-план действий

Дата: 2026-07-06. Основа: `docs/AGENT_PLAN_2M_RU.md`, `docs/PRODUCT_UX_SEO_COMMISSION_RU.md`, `ROADMAP.md`, `docs/GROWTH_STRATEGY_RU.md`, `docs/WORKFLOWS_AND_SKILLS_RU.md`.

Цель: вести WhiteS не набором отдельных фич, а серией маленьких production-срезов, каждый из которых улучшает один шаг цикла `увидел -> понял -> сообщил/подтвердил -> поделился -> вернулся`.

## Принципы выполнения

- Один release-slice = один пользовательский outcome, один критерий успеха, один rollback-путь.
- Safety и приватность сильнее SEO, роста, дизайна и удобства.
- Сначала доверие к данным и измерение, потом новые входящие каналы.
- Карта остается полезной без регистрации, внешних трекеров, точной геолокации и тяжелых зависимостей.
- На карточке отчета не больше двух основных действий.
- Любой видимый релиз проходит mobile/desktop visual gate; любой deployable-релиз проходит preflight, package, deploy и live smoke.

## Карта работ

| Пласт | Outcome | Приоритет | Файлы | Gate | Deploy |
|---|---|---:|---|---|---|
| Подтверждения в public export | Пользователь видит общий счетчик после пересборки `reports.json` | P0 | `public-lite/admin/index.php`, `tests/php/`, `docs/` | PHP test, public data validation, e2e | Да |
| Приватная аналитика | Команда видит события без cookies/IP/UA | P0 | `public-lite/api/event.php`, `admin/index.php`, `app.js` | allowlist events, no PII, e2e smoke | Да |
| Mobile/list clarity | Новый трафик быстро понимает статус и CTA | P0 | `index.html`, `styles.css`, `app.js`, e2e | 320/390/1440 screenshots, no overflow | Да |
| Regional safety spec | SEO-страницы не раскрывают лишнего | P0 | `docs/REGIONAL_PAGES_SPEC_RU.md`, `PUBLIC_DATA_CONTRACT.md` | trust/safety checklist | Нет |
| Regional generator | Поиск получает безопасные региональные сводки | P0 | `scripts/`, `public-lite/r/`, `sitemap.xml` | JSON-LD, sitemap, e2e, live 200 | Да |
| Embed/media kit | Каналы могут встроить безопасный статус региона | P1 | `public-lite/embed/`, `media.html`, docs | noindex/api safety, iframe smoke | Да |
| PWA/mobile polish | Карта удобнее в поле и офлайн | P1 | `sw.js`, `manifest.json`, `styles.css` | Lighthouse/PWA smoke, iOS notes | Да |
| Monthly growth report | Решения идут по метрикам, а не ощущениям | P1 | `docs/GROWTH_STRATEGY_RU.md` | event counters reviewed | Нет |
| Scale/data quality | Сотни отчетов не ломают UX | P2 | `app.js`, `reports.json` contract | perf budget, list fallback | Да |

## Последовательность P0

### 1. Подтверждения в публичный экспорт

Пользовательский outcome: после клика `Я тоже это вижу` подтверждение становится частью общего публичного счетчика после модераторской пересборки.

Сделать:

- при `export_public` считать `confirmation_count = базовый счетчик public_reports + COUNT(confirmations)`;
- повторные голоса одного устройства не должны увеличивать счетчик из-за `UNIQUE(report_id, device_hash)`;
- не удваивать счетчики при повторной пересборке;
- добавить тест на экспорт;
- задеплоить, проверить live `admin`/API syntax и `reports.json`.

Критерий готовности: после rebuild `reports.json` показывает общий счетчик, а повторный rebuild не меняет число без новых подтверждений.

### 2. Privacy-safe analytics gate

Пользовательский outcome: команда понимает, где люди подтверждают/делятся/отправляют отчет, не собирая идентификаторы.

Сделать:

- `api/event.php` принимает только allowlist: `share_clicked`, `confirm_clicked`, `report_submitted`, `deeplink_open`, `region_page_view`;
- таблица `events_daily(day,event,count)` без user id, cookies, IP, UA, fingerprint;
- `track(event)` в `app.js` работает fire-and-forget и silently fails;
- вкладка в админке показывает простую таблицу за последние дни.

Критерий готовности: события считаются и видны в админке; внешних скриптов нет.

### 3. Mobile/list clarity

Пользовательский outcome: на 320-390px пользователь сразу видит статус, CTA, свежесть и безопасный путь действия.

Сделать:

- проверить первый экран, список, форму, empty/error states;
- усилить липкость CTA/активных фильтров только если это не перекрывает контент;
- добавить visual assertions для формы и карточек.

Критерий готовности: нет horizontal overflow, touch targets >= 44px, warning и CTA видны.

### 4. Regional pages safety spec

Пользовательский outcome: SEO-страница региона дает аварийный снимок, а не опасный или панический лендинг.

Сделать:

- описать шаблон `/r/<slug>/`;
- зафиксировать slug contract, safe aggregates, JSON-LD `WebPage`/`Dataset`/`ItemList`;
- запретить raw comments, exact locations, per-report pages, `SpecialAnnouncement`.

Критерий готовности: генератор можно писать без устных пояснений.

### 5. Regional generator

Пользовательский outcome: человек из поиска получает текстовую сводку региона и кнопку открыть карту.

Сделать:

- генерировать статические `/r/<slug>/index.html` из `reports.json`;
- добавить региональные URL в sitemap;
- добавить перелинковку из карты;
- проверить JSON-LD, sitemap, live 200.

Критерий готовности: активные регионы имеют безопасные страницы, Search Console можно подключать без риска.

## Workflow для исполнителя

1. Прочитать `docs/CURRENT_STATUS_RU.md`, `docs/WORKFLOWS_AND_SKILLS_RU.md`, `docs/PRODUCT_UX_SEO_COMMISSION_RU.md`, этот файл.
2. Выбрать первый незавершенный P0-slice.
3. Назвать outcome, touched files, gates, deploy/rollback.
4. Сделать минимальную production-реализацию.
5. Прогнать проверки: syntax, public-data validation, e2e, package; для UI — screenshots.
6. Если менялись deployable assets — deploy current URL и будущий каталог субдомена.
7. Обновить `docs/CURRENT_STATUS_RU.md` и `docs/DEPLOY_STATUS_RU.md`.
8. Commit + push в ветку агента.

## Текущий execution log

- 2026-07-06: выполнен и задеплоен P0-slice `Подтверждения в public export`.
  - Код: `public-lite/admin/index.php`.
  - Тесты: `tests/php/admin_export_confirmation_test.php`, optional PHP hook в `tests/run_tests.js`.
  - Regression cleanup: стабилизированы flaky Playwright-проверки hover marker и spam click.
  - Проверки: public-data validation, JS syntax, server PHP syntax, PHP regression test, `npm test` -> `108 passed`, package, live smoke.
  - Следующий P0: `Privacy-safe analytics gate`.
- 2026-07-06: выполнен P0-slice `Privacy-safe analytics gate`.
  - Код: `public-lite/api/event.php`, `public-lite/api/_bootstrap.php`, `public-lite/admin/index.php`, `public-lite/app.js`.
  - Данные: таблица `events_daily(day,event,count,updated_at)`; только allowlist событий.
  - Privacy: не пишутся cookies, IP, user-agent, user id, referrer, URL, path или payload страницы.
  - Тесты: `tests/php/event_counter_test.php`, `T4.10` на allowlisted frontend events.
  - Следующий P0: `Mobile/list clarity gate`.
