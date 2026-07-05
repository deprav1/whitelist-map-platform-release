# Workflow и skills WhiteS

Цель документа: дать проекту постоянную рабочую систему. Любая итерация WhiteS должна начинаться не с догадок, а с правильного сценария: UX, данные, модерация, релиз, инцидент или рост.

## Главный принцип

WhiteS — аварийная карта доступности интернета. Пользователь часто открывает её в плохой сети, с телефона и в тревожной ситуации. Поэтому порядок приоритетов всегда такой:

1. безопасность человека;
2. честность и свежесть данных;
3. понятность интерфейса;
4. скорость загрузки;
5. визуальная полировка.

Если эти пункты конфликтуют, выигрывает более безопасное и более простое решение.

## Быстрый старт для нового агента

Перед работой прочитать:

- `docs/CURRENT_STATUS_RU.md` — что сейчас опубликовано и что следующее;
- `docs/LOCAL_PATHS_RU.md` — где лежат файлы, команды и деплой;
- `docs/PUBLIC_DATA_CONTRACT.md` — какие данные можно показывать публично;
- этот документ — какой workflow выбрать.
- `docs/PRODUCT_UX_SEO_COMMISSION_RU.md` — обязательная рамка для product/UX/design/SEO решений.
- `docs/MEGA_ACTION_PLAN_RU.md` — текущий исполняемый backlog по P0/P1/P2.

Если задача про интерфейс, дополнительно читать `docs/UX_PRODUCT_PLAN_RU.md`.

Если задача про публикацию, читать `docs/PUBLIC_LITE_DEPLOY_RU.md`, `docs/SSH_ACCESS_RU.md`, `docs/SUBDOMAIN_TIMEWEB_RU.md`.

Если задача про прием пользовательских отчетов или хранение, читать `docs/TIMEWEB_STORAGE_RU.md`.

Если задача про безопасность или тексты формы, читать `docs/SAFETY_RU.md`, `docs/MODERATION_RU.md`, `docs/REPORT_RULES_RU.md`, `docs/PRIVACY_RU.md`.

## Workflow 1: UX и продуктовая итерация

Когда использовать:

- меняется первый экран, карта, список, фильтры, форма, модалки;
- пользователь жалуется, что “выглядит плохо” или “неудобно”;
- нужно улучшить мобильный сценарий.

Входные файлы:

- `public-lite/index.html`;
- `public-lite/styles.css`;
- `public-lite/app.js`;
- `docs/UX_PRODUCT_PLAN_RU.md`;
- `docs/CONSILIUM_AND_DEVELOPMENT_PLAN_RU.md`.

Шаги:

1. Сформулировать пользовательский сценарий: “открыл карту”, “ищет свой регион”, “сообщает проблему”, “плохая сеть”.
2. Проверить, что список остаётся полезным без карты и внешнего фона.
3. Проверить мобильную ширину около `390px` и десктоп около `1440px`.
4. Не добавлять лишний маркетинговый слой: первый экран должен быть инструментом, а не лендингом.
5. После изменений сделать Playwright-скриншоты изменённых экранов.

Критерии готовности:

- нет горизонтального переполнения на мобильном;
- важный текст не обрезается;
- CTA `Сообщить` доступен быстро;
- статус данных и свежесть видны;
- `npm test` проходит.

## Workflow 2: Публичные данные и модерация

Когда использовать:

- меняется `reports.json`;
- добавляются поля отчётов;
- готовится импорт из формы/бота/Ushahidi;
- нужно скрыть опасную запись.

Входные файлы:

- `docs/PUBLIC_DATA_CONTRACT.md`;
- `docs/MODERATION_RU.md`;
- `docs/SPAM_DUPLICATES_RU.md`;
- `public-lite/reports.json`;
- `data/public-reports.sample.json`.

Красные линии:

- не публиковать ФИО, телефоны, email, точные адреса, точные GPS, IP, user-agent;
- не публиковать сырые комментарии без модерации;
- не публиковать названия, ссылки, ключи или инструкции для VPN/прокси;
- не смешивать `pending`, `rejected`, `private`, `merged` с публичным `published`.

Проверка:

```powershell
.\scripts\validate-public-data.ps1
rg -n -i "demo|демо" public-lite README.md scripts tests package.json
```

Критерии готовности:

- все публичные записи безопасны;
- `updated_at` обновлён, если данные реально менялись;
- фронтенд не падает при пустом списке или неполных optional-полях;
- документация контракта обновлена, если менялась схема.

## Workflow 3: Релиз и деплой

Когда использовать:

- меняются `public-lite/index.html`, `app.js`, `styles.css`, `sw.js`, `reports.json`;
- нужно выложить изменения на Timeweb;
- меняется версия service worker или cache-busting query.

Предрелизная проверка:

```powershell
node --check public-lite\app.js
node --check public-lite\sw.js
.\scripts\validate-public-data.ps1
npm test
.\scripts\package-public-lite.ps1
```

Деплой на текущий URL:

```powershell
.\scripts\deploy-public-lite-ssh.ps1 `
  -HostName "vh464.timeweb.ru" `
  -UserName "cb077728" `
  -RemotePublicHtml "/home/c/cb077728/KidAI/public_html/whites"
```

Деплой в каталог будущего субдомена:

```powershell
.\scripts\deploy-public-lite-ssh.ps1 `
  -HostName "vh464.timeweb.ru" `
  -UserName "cb077728" `
  -RemotePublicHtml "/home/c/cb077728/whites.kidai.website/public_html"
```

Проверка после деплоя:

```powershell
Invoke-WebRequest -Uri "https://kidai.website/whites/" -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
Invoke-WebRequest -Uri "https://kidai.website/whites/sw.js" -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
Invoke-WebRequest -Uri "https://kidai.website/whites/reports.json" -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
```

Критерии готовности:

- live URL отдаёт `200`;
- HTML содержит актуальные `app.js?v=...` и `styles.css?v=...`;
- `sw.js` содержит актуальный `CACHE_NAME`;
- `reports.json` отдаётся и не содержит запрещённой демо-лексики;
- `docs/DEPLOY_STATUS_RU.md` обновлён.

## Workflow 4: Инцидент и privacy takedown

Когда использовать:

- в публичной карте найден персональный риск;
- сайт не открывается;
- опубликованы ошибочные/опасные данные;
- пользователь просит убрать запись.

Порядок:

1. Сначала убрать риск из публичных данных или временно скрыть запись.
2. Запустить `validate-public-data.ps1`.
3. Срочно задеплоить исправление.
4. Проверить live URL.
5. После стабилизации разобраться в причине и обновить правила/модерацию.

Критерий: безопасность важнее красивого расследования.

## Workflow 5: Рост, исследование и roadmap

Когда использовать:

- планируются новые фичи;
- нужно сравнить варианты хостинга, базы, бота, аналитики;
- нужно продумать сценарии российской аудитории.

Входные файлы:

- `ROADMAP.md`;
- `docs/MONTH_PLAN_RU.md`;
- `docs/ROADMAP_RU.md`;
- `.agents/roadmap/README.md`;
- `docs/DATABASE_OPTIONS.md`;
- `docs/TIMEWEB_STORAGE_RU.md`.

Правила:

- отделять “можно придумать” от “можно безопасно запустить”;
- для каждой фичи фиксировать риск для пользователя, цену инфраструктуры и критерий успеха;
- не добавлять регистрацию, телефон или точную геолокацию ради роста.

## Workflow 6: Консилиум агентов

Использовать, когда решение затрагивает безопасность, модерацию, доверие или крупный UX-поворот.

Роли:

- правозащитный советник — риск для пользователя;
- digital-safety — данные, логи, трекеры, хранение;
- продуктовый дизайнер — понятность, мобильный UX, доступность;
- ресерчер данных — схема, дедупликация, доверие;
- SEO-оптимизатор — поиск, сниппеты, sitemap, структурированные данные;
- инфраструктурный lead — деплой, бэкапы, масштабирование;
- редактор/модератор — тон, правила, опасные формулировки.

Итог консилиума должен быть не “мнения”, а список P0/P1 задач с файлами и критериями готовности.

Для product/UX/design/SEO планирования использовать расширенную комиссию:

- `docs/PRODUCT_UX_SEO_COMMISSION_RU.md`;
- `.agents/product-ux-seo/README.md`.

Результат такой комиссии обязан содержать:

1. один пользовательский outcome;
2. список veto/risk;
3. P0/P1 slices с файлами;
4. gate-проверки;
5. нужен ли deploy;
6. как измерить результат.

## Workflow 7: SEO и публичное распространение

Когда использовать:

- меняются title, description, Open Graph, manifest, robots.txt или sitemap;
- добавляются региональные страницы;
- нужно улучшить поисковую видимость без роста риска для пользователей.

Входные файлы:

- `public-lite/index.html`;
- `public-lite/robots.txt`;
- `public-lite/sitemap.xml`;
- `public-lite/manifest.json`;
- `public-lite/reports.json`;
- `docs/PUBLIC_DATA_CONTRACT.md`;
- `docs/SAFETY_RU.md`.

Правила:

1. Индексировать только публично безопасные и модерированные данные.
2. Не создавать страницы по точному адресу, точной геоточке, человеку, месту работы или личному маршруту.
3. Не добавлять VPN/прокси названия, ссылки, ключи или инструкции ради трафика.
4. Не добавлять `?report=`, `share.php`, API, `/admin/` или служебные endpoints в sitemap.
5. OG, share-preview и embed считать публичной публикацией: только safe published fields.
6. Для JSON/PHP служебных ответов держать `X-Robots-Tag: noindex, noarchive`; robots.txt не считать privacy-защитой.
7. JSON-LD региональных страниц делать как `WebPage`/`Dataset`/`ItemList`; не использовать `SpecialAnnouncement` как цель rich-result.
8. После изменения метаданных обновить cache-busting и проверить live HTML, `robots.txt`, `sitemap.xml`, `manifest.json`.
9. Для региональных страниц сначала генерировать текстовую сводку из `reports.json`, затем добавлять URL в sitemap.

Критерии готовности:

- основной URL имеет понятные title/description/OG;
- `robots.txt` указывает на sitemap;
- `manifest.json` использует реальные PNG 192/512 и maskable icons;
- structured data не раскрывает ничего сверх публичной карты;
- per-report/share/API/admin URL не индексируются и не попадают в sitemap;
- `npm test` и релизная проверка проходят.

## Workflow 8: Коррекция плана product/UX/design/SEO

Когда использовать:

- меняется `docs/AGENT_PLAN_2M_RU.md`, roadmap, SEO/growth стратегия;
- нужно выбрать следующий крупный slice;
- есть конфликт между удобством, дизайном, SEO, safety и скоростью релиза.

Входные файлы:

- `docs/AGENT_PLAN_2M_RU.md`;
- `docs/PRODUCT_UX_SEO_COMMISSION_RU.md`;
- `.agents/product-ux-seo/README.md`;
- `docs/GROWTH_STRATEGY_RU.md`;
- `docs/SERVICE_DESIGN_AUDIT_PLAN_RU.md`;
- `docs/CONSILIUM_AND_DEVELOPMENT_PLAN_RU.md`.

Порядок:

1. Назвать пользовательский цикл, который улучшается: `увидел`, `понял`, `сообщил`, `подтвердил`, `поделился`, `нашел через поиск`.
2. Провести роли комиссии: product, UX, visual design, SEO, trust/safety, data/moderation, infra.
3. Отсечь задачи с veto.
4. Проверить текущий порядок P0: confirmations -> private analytics -> mobile clarity -> regional page spec -> regional generator.
5. Разбить оставшееся на P0/P1 small releases.
6. Для каждого slice указать файлы, тесты, visual/SEO/safety gates и deploy-критерий.
7. Обновить `docs/AGENT_PLAN_2M_RU.md` или отдельный plan doc.

Критерий готовности:

- план можно выполнить агентом без устных пояснений;
- нет задач, которые требуют точной геолокации, регистрации, внешних трекеров или raw data;
- первый следующий slice можно начать сразу.

## Skill stack для проекта

### Локальный skill `whites-project`

Создан на этой машине:

```text
C:\Users\Lenovo\.codex\skills\whites-project
```

Когда использовать:

- любая задача по WhiteS, где нужно быстро восстановить контекст;
- деплой, проверка, UX-доработка, public data, модерация, roadmap;
- перед передачей работы другому агенту.

Что делает:

- маршрутизирует задачу к нужным документам;
- напоминает красные линии;
- даёт команды проверки и деплоя;
- фиксирует definition of done.

### Skill `playwright`

Использовать для:

- проверки локальной карты в браузере;
- скриншотов desktop/mobile;
- тестирования формы, фильтров, Telegram deep-link;
- визуального контроля после UX-правок.

### Product/UX/SEO agent route

Локальный runbook:

```text
.agents/product-ux-seo/README.md
```

Использовать для:

- коррекции roadmap и 2-месячного плана;
- региональных SEO-страниц;
- UX/design gate перед релизом;
- выбора следующего product slice;
- проверки, что growth не ломает safety.

### Skill `skill-creator`

Использовать, если нужно создать или обновить проектный Codex skill. Например, если `whites-project` станет слишком большим, его можно разделить на:

- `whites-moderation`;
- `whites-release`;
- `whites-data-export`;
- `whites-ux-review`.
- `whites-seo`.
- `whites-product-commission`.

Перед созданием новых skills сначала обновить `.agents/product-ux-seo/README.md`; отдельный skill нужен только если runbook перестал помещаться в один воспроизводимый маршрут.

### Security skills

Использовать только когда задача явно про security review, threat model или secure-by-default. Для обычной UX-правки достаточно красных линий из этого документа и safety docs.

## Definition of done для любой задачи

Задача WhiteS считается готовой, когда:

- не нарушены privacy/safety красные линии;
- изменённые данные валидируются;
- изменённый JS проходит `node --check`;
- релевантные e2e тесты или весь `npm test` проходят;
- визуальные изменения проверены хотя бы на мобильном и десктопе;
- deploy выполнен или явно не требовался;
- live URL проверен, если был deploy;
- docs обновлены, если изменились workflow, путь, версия или публичный статус;
- изменения закоммичены и запушены, если работа должна попасть в `main`.
