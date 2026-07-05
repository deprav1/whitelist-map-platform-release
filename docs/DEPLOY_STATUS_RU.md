# Статус деплоя public-lite

Дата: 2026-07-05.

## Production-beta

URL:

```text
https://kidai.website/whites/
```

Опубликовано:

- cache-buster `20260705-offline3`;
- service worker cache `whites-public-lite-offline3`;
- `faq.html`, `rules.html`, `privacy.html`;
- UX-обновления: trust-cues на первом экране, low-bandwidth действия, sticky-фильтры только при активных фильтрах, inline risk-подсказка формы;
- публичный `reports.json` с `export_manifest.schema_version: 1.1`;
- демо-набор из 10 модерированных примерных записей.

Перед деплоем сохранен backup live `reports.json`:

```text
backups/public-lite/reports-20260705-195227.json
```

Проверки после деплоя:

```powershell
.\scripts\check-public-lite-live.ps1 -CheckExtendedPages -ExpectedCacheName "whites-public-lite-offline3"
```

Результат:

- главная, FAQ, правила, приватность, `sw.js`, `reports.json`, `api/context.php` отвечают `200`;
- `submissions/observations-pending.jsonl` отвечает `403`;
- TLS для `kidai.website` действителен до 2026-09-05;
- live `reports.json` прошел validation и safety audit;
- `export_manifest.record_count` равен числу записей;
- live browser-smoke подтвердил мобильный список 390px, desktop 1440px, sticky-фильтры, trust-cues и risk-подсказку формы.

Ранее после деплоя очищены старые публичные хвосты, которые не входят в текущий `public-lite` пакет; при деплое `20260705-offline3` новых stale-файлов не найдено:

- `admin/`;
- старые `api/health.php`, `api/submit.php`, `api/complaint.php`, `api/confirm.php`, `api/og.php`;
- старые `icons/`, `manifest.json`, `share.php`, `og-image.*`, `sitemap.xml`.

Перед удалением они заархивированы на сервере:

```text
/home/c/cb077728/whites-stale-backups/20260705-203641-whites/stale-public-files.tar.gz
/home/c/cb077728/whites-stale-backups/20260705-203642-public_html/stale-public-files.tar.gz
```

## Future subdomain

```text
https://whites.kidai.website/
```

Серверная папка:

```text
/home/c/cb077728/whites.kidai.website/public_html
```

Статус:

- свежая сборка `20260705-offline3` выложена в серверную папку будущего субдомена;
- DNS/сайт в панели Timeweb еще нужно создать;
- SSL для `whites.kidai.website` еще нужно включить после создания сайта;
- `Resolve-DnsName whites.kidai.website` сейчас возвращает, что DNS-имя не существует.

## Контроль 2026-07-06

Read-only live-smoke снова пройден для рабочего URL:

```powershell
.\scripts\check-public-lite-live.ps1 -CheckExtendedPages -ExpectedCacheName "whites-public-lite-offline3"
.\scripts\run-public-lite-preflight.ps1 -IncludeLiveCheck -CheckExtendedLivePages -ExpectedCacheName "whites-public-lite-offline3"
```

Результат: `https://kidai.website/whites/` отдает `offline3`, расширенные страницы доступны, `reports.json` проходит validation и safety audit, `submissions/observations-pending.jsonl` закрыт `403`, TLS `kidai.website` действителен до 2026-09-05. Для `whites.kidai.website` DNS еще не создан, поэтому cutover остается заблокирован панелью Timeweb.
