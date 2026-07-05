# Статус деплоя WhiteS

Дата: 2026-07-06

## Mega-plan + confirmation aggregation slice

- Добавлен исполняемый mega-plan: `docs/MEGA_ACTION_PLAN_RU.md`.
- Выполнен P0-slice `Подтверждения в public export`: при пересборке админкой `reports.json` теперь считает `confirmation_count` как базовый счетчик `public_reports` плюс уникальные записи из таблицы `confirmations`.
- Повторная пересборка не должна удваивать счетчик: JSON-only записи сохраняются как есть, а DB-записи пересчитываются от базового значения в `public_reports`.
- Добавлен PHP regression test `tests/php/admin_export_confirmation_test.php`; локально он пропускается, если на машине нет `php`, и запускается автоматически в окружениях с PHP.
- Проверки: `node --check public-lite\app.js`, `node --check public-lite\sw.js`, `node --check tests\run_tests.js`, `.\scripts\validate-public-data.ps1`, `npm test` -> `108 passed`, `.\scripts\package-public-lite.ps1`.
- Серверный PHP 8.2: `php -l` для deployed `admin/index.php` на обоих путях, regression test в `/tmp` -> `admin_export_confirmation_test OK`.
- Деплой выполнен на `https://kidai.website/whites/` и в серверный каталог будущего `whites.kidai.website`.
- Live-check: главная `200`, `api/health.php` `200` + `X-Robots-Tag`, `reports.json` `200` + `X-Robots-Tag`, `/admin/` `200` + `X-Robots-Tag`; deployed admin содержит `admin_confirmation_counts`.
- `Resolve-DnsName whites.kidai.website` все еще не готов.

## Product/UX/SEO commission + SEO safety cleanup

- Создана комиссия product/UX/design/SEO: `docs/PRODUCT_UX_SEO_COMMISSION_RU.md`.
- Добавлены agent runbooks: `.agents/product-ux-seo/README.md`, `.agents/roadmap/README.md`.
- Скорректирован 2-месячный план: сначала confirmation aggregation, затем privacy-safe analytics, mobile clarity gate, regional page safety spec и только потом генератор `/r/<region>/`.
- `reports.json` удален из `public-lite/sitemap.xml`.
- В `.htaccess` добавлен `X-Robots-Tag: noindex, noarchive` для JSON/PHP служебных ответов.
- `SpecialAnnouncement` снят как DoD-цель; для региональных страниц ориентир `WebPage`/`Dataset`/`ItemList`.
- Деплой выполнен на `https://kidai.website/whites/` и в серверный каталог будущего `whites.kidai.website`.
- Live-check вручную: главная `200`, sitemap `200`, `reports.json` `200` + `X-Robots-Tag`, `api/health.php` `200` + `X-Robots-Tag`, `api/og.php` `200 image/png` + `X-Robots-Tag`, `share.php?region=moskva` `200` + `X-Robots-Tag`; sitemap не содержит `reports.json`.
- `Resolve-DnsName whites.kidai.website` все еще не готов.
- Замечание: deploy script на Windows успешно распаковал архив, но в конце remote shell печатает CRLF warnings вида `$'\r': command not found`; нужна отдельная мелкая правка скрипта нормализации remote bash-команд.

## Growth-релиз (Фазы A + B)

- Версия ассетов: `app.js?v=20260704-phaseb`, `styles.css?v=20260704-phaseb`; SW cache `whites-v17`.
- Фаза A (стиль): индикатор доверия на карточках/popup, 2×2 quick-filters на мобиле, схематичная карта без тайлов.
- Фаза B (виральность): deep-links `?report=`/`?region=` с подсветкой; отчёт-зависимый шеринг; динамический OG-image `api/og.php` (main/region/report, PNG через GD, fallback на `og-image.png`); `share.php` + rewrite в `.htaccess` отдают crawler'у контекстные OG-мета; нудж «Поделиться» после подтверждения.
- Live-проверка: index 200; `api/og.php` → 200 image/png; `?report=<id>` → og:image `api/og.php?report=<id>`; `api/confirm.php` пустой POST → 422.
- E2E: `108 passed`.

---

## Прежний чекпоинт (Дата: 2026-07-03)

## Что опубликовано

- Рабочий публичный URL: https://kidai.website/whites/
- Проверка после деплоя: HTTP 200.
- Версия фронтенда в HTML: `app.js?v=20260703-confirm`.
- Версия CSS в HTML: `styles.css?v=20260703-confirm`.
- Версия Service Worker cache: `whites-v11`.
- Report loop 1.3: подтверждения «Я тоже это вижу» на карточках и в popup; оптимистичный инкремент, один голос на устройство (localStorage), бэкенд `api/confirm.php` с дедупом через `UNIQUE(report_id, device_hash)`. Проверено live: 201 при первом голосе, `already_confirmed` при повторном, `health.php` schema_version 2.
- SEO/PWA: опубликованы `sitemap.xml`, `robots.txt` с sitemap, JSON-LD, `og-image.png`, PNG icons 192/512 + maskable.
- Safety UX: опубликована кнопка жалобы на публичную отметку в карточках и popup; жалоба формируется как Telegram-черновик без запроса контактов.
- Storage MVP: опубликован `public-lite/api/` для приема отчетов и жалоб в приватную SQLite-базу Timeweb с резервным Telegram-черновиком.
- Moderation MVP: опубликован закрытый `/admin/` для просмотра очередей, публикации безопасных записей и пересборки `reports.json`.
- Публичные формулировки используют только рабочий статус модерируемых данных.
- UX-упрощение комиссии скептиков: первый экран “Сбои интернета сейчас”, список первым на мобильном, один главный CTA, честный текст премодерации, резервный Telegram-текст спрятан.
- Мобильная карта и список обновлены в UX-релизе `ff79b8b`.
- Архив для ручной загрузки: `tmp/whites-public-lite.zip`.
- Приватная база Timeweb: `/home/c/cb077728/KidAI/whites-data/whites.sqlite`.
- Приватный admin token: `/home/c/cb077728/KidAI/whites-data/admin-token.txt`.

## Timeweb пути

Рабочий путь, который сейчас доступен публично:

```powershell
.\scripts\deploy-public-lite-ssh.ps1 `
  -HostName "vh464.timeweb.ru" `
  -UserName "cb077728" `
  -RemotePublicHtml "/home/c/cb077728/KidAI/public_html/whites"
```

Путь будущего субдомена уже заполнен файлами:

```powershell
.\scripts\deploy-public-lite-ssh.ps1 `
  -HostName "vh464.timeweb.ru" `
  -UserName "cb077728" `
  -RemotePublicHtml "/home/c/cb077728/whites.kidai.website/public_html"
```

## Что осталось для субдомена

`whites.kidai.website` пока не открывается публично, потому что DNS-имя не существует. Нужно создать/привязать субдомен в панели Timeweb:

- домен: `whites.kidai.website`;
- корень сайта: `/home/c/cb077728/whites.kidai.website/public_html`;
- после создания проверить: `Resolve-DnsName whites.kidai.website`;
- затем открыть: https://whites.kidai.website/

## Проверки перед публикацией

Выполнено:

```powershell
node --check public-lite\app.js
node --check public-lite\sw.js
.\scripts\validate-public-data.ps1
npm test
```

Итог E2E: `106 passed` (добавлен T4.7 на цикл подтверждений).

Примечание: в прод-таблице `confirmations` остались 2 тестовые probe-записи (`e2e_probe_delete`, `probe2`) от live-проверки endpoint — безвредны (ссылаются на несуществующие отметки), удалить при следующем доступе к SQLite.

Дополнительно проверено после публикации:

```powershell
Invoke-WebRequest https://kidai.website/whites/
Invoke-WebRequest https://kidai.website/whites/api/health.php
npx playwright screenshot --wait-for-timeout=3000 --viewport-size=1440,900 https://kidai.website/whites/
npx playwright screenshot --wait-for-timeout=3000 --viewport-size=390,844 https://kidai.website/whites/
```

Итог live-проверки: HTTP 200, SQLite health `ok`, новая версия ассетов в HTML, старый текст “Форма не сохраняет...” отсутствует.
