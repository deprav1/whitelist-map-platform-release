# Хранилище WhiteS на Timeweb

Дата решения: 2026-07-03.

## Коротко

Для первого публичного MVP используется PHP + SQLite на обычном хостинге Timeweb.

Причина: на текущем тарифе уже доступны PHP 8.2, `pdo_sqlite` и `sqlite3`, поэтому не нужна отдельная платная база данных. Это достаточно для старта, если публичная карта продолжает читать только безопасный `reports.json`, а сырые пользовательские заявки остаются приватными.

## Где лежит база

Приватная папка на сервере для текущего URL `https://kidai.website/whites/`:

```text
/home/c/cb077728/KidAI/whites-data
```

Файл базы:

```text
/home/c/cb077728/KidAI/whites-data/whites.sqlite
```

Эта папка находится вне `public_html`. Права должны быть `700`. Для будущего субдомена будет использоваться аналогичный путь:

```text
/home/c/cb077728/whites.kidai.website/whites-data/whites.sqlite
```

## Публичные API

Файлы API лежат в:

```text
public-lite/api/
```

Endpoints:

- `api/health.php` - проверка SQLite-схемы и доступности записи;
- `api/submit.php` - прием нового отчета в `pending_review`;
- `api/complaint.php` - прием жалобы на опубликованную отметку в `open`.
- `api/event.php` - privacy-safe счетчик allowlist-событий по дням, без cookies/IP/UA/user id.
- `admin/index.php` - закрытая мини-админка модерации.

API не сохраняет IP и user-agent в таблицы WhiteS. Хостинг может вести собственные технические access-логи, поэтому публичные тексты не обещают невозможного.

## Что хранится

Таблицы:

- `submissions` - сырые пользовательские отчеты в премодерации;
- `complaints` - жалобы на публичные записи;
- `public_reports` - будущая таблица только для записей, готовых к экспорту в `reports.json`;
- `moderation_events` - будущий журнал действий модератора.
- `events_daily` - агрегаты продуктовых событий: `day`, `event`, `count`, `updated_at`; без IP, user-agent, cookies, user id, referrer или URL.
- `admin-token.txt` - файл токена админки в приватной папке, не таблица и не git-файл.

Новые записи из формы не публикуются автоматически. Карта показывает только `reports.json`, где должны быть только `status: "published"` и безопасные поля из `docs/PUBLIC_DATA_CONTRACT.md`.

## Мини-админка

Рабочий URL после деплоя:

```text
https://kidai.website/whites/admin/
```

Админка защищена токеном из приватного файла:

```text
/home/c/cb077728/KidAI/whites-data/admin-token.txt
```

Токен не хранить в репозитории и не публиковать в задачах. Создать или убедиться, что он есть:

```powershell
.\scripts\setup-timeweb-storage.ps1 -EnsureAdminToken
```

Что умеет админка:

- показать новые `submissions` со статусом `pending_review`;
- показать открытые `complaints`;
- опубликовать отчет как безопасную публичную запись;
- отклонить отчет;
- закрыть жалобу;
- пересобрать `reports.json` из текущего файла и таблицы `public_reports`;
- записать действие в `moderation_events`.

При публикации модератор обязан очистить публичные поля. Админка блокирует публикацию, если публичные поля похожи на email, телефон, URL, social handle или точный адрес.

## Проверка и подготовка

Создать приватную папку и проверить API после деплоя:

```powershell
.\scripts\setup-timeweb-storage.ps1
```

Создать приватную папку, токен админки и проверить API:

```powershell
.\scripts\setup-timeweb-storage.ps1 -EnsureAdminToken
```

Проверить вручную:

```powershell
Invoke-WebRequest -UseBasicParsing https://kidai.website/whites/api/health.php
```

Проверить PHP-синтаксис на сервере:

```powershell
ssh -i $env:USERPROFILE\.ssh\whites_timeweb_ed25519 cb077728@vh464.timeweb.ru "php -l /home/c/cb077728/KidAI/public_html/whites/api/submit.php"
```

## Масштабирование

SQLite подходит для старта и умеренного потока заявок. Сигналы для миграции в MySQL/Postgres:

- сотни заявок в день;
- нужна админка с несколькими модераторами;
- нужны частые агрегирующие запросы и дедупликация;
- нужен регулярный бэкап/репликация на уровне провайдера.

До миграции обязательны регулярные резервные копии `whites.sqlite` и экспорт публичного `reports.json`.
