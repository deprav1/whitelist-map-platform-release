# Рабочие процессы и навыки WhiteS

Дата обновления: 2026-07-05.

Этот файл нужен как короткая точка входа для человека или AI-агента, который продолжает работу над проектом "Где белые списки?". Подробные планы остаются в профильных документах, а здесь собраны безопасный порядок действий, проверки и границы.

## С чего начинать

Перед любыми изменениями прочитать:

- `docs/CURRENT_STATUS_RU.md` - фактический статус, live URL, последние проверки и стопоры.
- `docs/CONSILIUM_AND_DEVELOPMENT_PLAN_RU.md` - красные линии, роли и процесс решений.
- `docs/RADICAL_PRODUCT_IMPROVEMENT_PLAN_RU.md` - текущий продуктовый P0/P1 план.
- `docs/PUBLIC_DATA_CONTRACT.md` - контракт публичного JSON, если затрагиваются данные.

Для дорожной карты также читать `ROADMAP.md` и `.agents/roadmap/README.md`.

## Красные линии

Нельзя публиковать или переносить в `reports.json`:

- ФИО, телефоны, email, аккаунты, точные адреса, точные GPS-координаты.
- IP, user-agent, source_hash, внутренние модераторские заметки.
- Сырые комментарии до модерации.
- Ссылки, вложения, VPN/proxy-инструкции, ключи или конфиги.

Публичный слой должен оставаться полезным без регистрации, без точной геолокации и без внешних тайлов карты.

## Безопасные локальные проверки

Эти команды не должны менять продуктовые файлы:

```powershell
.\scripts\run-public-lite-preflight.ps1
```

Ручной эквивалент:

```powershell
node --check public-lite\app.js
node --check public-lite\sw.js
.\scripts\validate-public-data.ps1 -Path public-lite\reports.json
.\scripts\audit-public-data-safety.ps1 -Path public-lite\reports.json
.\scripts\validate-public-data.ps1 -Path public-lite\reports.sample.json
.\scripts\audit-public-data-safety.ps1 -Path public-lite\reports.sample.json
.\scripts\validate-public-data.ps1 -Path data\public-reports.sample.json
.\scripts\audit-public-data-safety.ps1 -Path data\public-reports.sample.json
.\scripts\check-moderation-test-cases.ps1
```

Для проверки production URL добавьте `-IncludeLiveCheck`; перед деплоем можно добавить `-IncludeBackup`, чтобы сохранить текущий live `reports.json` в `backups/public-lite/`. Для релизной проверки текущей оболочки используйте расширенный live-smoke:

```powershell
.\scripts\run-public-lite-preflight.ps1 -IncludeLiveCheck -CheckExtendedLivePages -ExpectedCacheName "whites-public-lite-offline3"
```

Если в корне появится `package.json`, дополнительно выполнить `npm test`.

## Перед упаковкой или деплоем

Упаковка создает или перезаписывает архив в `tmp\whites-public-lite.zip`, поэтому запускать ее только когда нужен релизный артефакт:

```powershell
.\scripts\package-public-lite.ps1
```

Перед деплоем обязательно сверить `docs/PUBLIC_LITE_DEPLOY_RU.md`, `docs/LOCAL_PATHS_RU.md`, `docs/SSH_ACCESS_RU.md` и `docs/SUBDOMAIN_TIMEWEB_RU.md`.

## Read-only live-smoke

Эти проверки читают production URL и ничего не меняют на сервере:

```powershell
.\scripts\check-public-lite-live.ps1
```

Для ручечной проверки отдельных URL:

```powershell
Invoke-WebRequest -Uri "https://kidai.website/whites/" -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
Invoke-WebRequest -Uri "https://kidai.website/whites/faq.html" -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
Invoke-WebRequest -Uri "https://kidai.website/whites/sw.js" -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
Invoke-WebRequest -Uri "https://kidai.website/whites/reports.json" -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
Invoke-WebRequest -Uri "https://kidai.website/whites/api/context.php" -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
Invoke-WebRequest -Uri "https://kidai.website/whites/submissions/observations-pending.jsonl" -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
```

Ожидаемо: публичные страницы и JSON отвечают `200`, а `submissions/observations-pending.jsonl` отвечает `403`.

Когда субдомен будет создан в Timeweb, можно добавить warning-only проверку DNS/HTTPS:

```powershell
.\scripts\check-public-lite-live.ps1 -CheckFutureSubdomain
```

После настройки DNS и SSL для `whites.kidai.website` можно сделать строгую cutover-проверку:

```powershell
.\scripts\check-public-lite-live.ps1 -BaseUrl "https://whites.kidai.website/" -CheckExtendedPages -ExpectedCacheName "whites-public-lite-offline3"
.\scripts\run-public-lite-preflight.ps1 -IncludeLiveCheck -CheckExtendedLivePages -ExpectedCacheName "whites-public-lite-offline3" -IncludeFutureSubdomainCheck -FailOnFutureSubdomainIssues
```

## Как выбирать следующую работу

Можно делать самостоятельно:

- Документацию, которая уточняет уже принятый процесс и не меняет публичные обещания.
- Валидации, syntax checks, safety audit и модераторские тест-кейсы.
- Небольшие исправления явных ошибок в проверках, если они не меняют публичный контракт.

Требует отдельного решения или реальных данных:

- Замена demo-данных на live-данные.
- Переименование demo-индикаторов в "живые данные".
- Деплой на production URL.
- Изменения модераторского pipeline, которые меняют публичный `reports.json`.
- Субдомен, SSL, Timeweb-панель и любые действия с секретами.

## Текущий безопасный вывод

Если нет реальных модерированных данных, demo-маркеры в `public-lite/reports.json`, `public-lite/app.js` и интерфейсе нельзя скрывать. Это честнее для пользователей и соответствует trust/safety-рамке проекта.
