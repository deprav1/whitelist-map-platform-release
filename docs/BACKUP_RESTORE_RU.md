# Резервные копии и восстановление

До публичного запуска нужно хотя бы один раз проверить, что backup можно восстановить.

## Что нужно сохранять

- MySQL-базу;
- папку `platform/storage`;
- текущий публичный `reports.json` перед деплоем или заменой данных;
- `.env` без публикации в репозиторий;
- список cron-задач;
- текущую версию кода.

## Быстрый backup публичного JSON

Перед деплоем или ручной заменой live-данных сохраните текущий публичный снимок:

```powershell
.\scripts\backup-public-reports.ps1
```

Скрипт скачивает `https://kidai.website/whites/reports.json`, проверяет его через `validate-public-data.ps1` и `audit-public-data-safety.ps1`, затем сохраняет копию в `backups/public-lite/`. Папка `backups` исключена из git.

## Shared hosting Timeweb

### База

Через панель Timeweb или SSH:

```bash
mysqldump -h <db_host> -u <db_user> -p <db_name> > whites-db-YYYY-MM-DD.sql
```

### Файлы

```bash
tar -czf whites-storage-YYYY-MM-DD.tar.gz platform/storage
```

### Скачать локально

```bash
scp <user>@<host>:/path/to/whites-db-YYYY-MM-DD.sql .
scp <user>@<host>:/path/to/whites-storage-YYYY-MM-DD.tar.gz .
```

## Docker/VPS

Если проект запущен через Docker Compose:

```bash
docker compose exec mysql mysqldump -uushahidi -p ushahidi > backups/whites-db-YYYY-MM-DD.sql
tar -czf backups/whites-storage-YYYY-MM-DD.tar.gz ./platform/storage
```

Пути могут отличаться в зависимости от volume и способа деплоя.

## Проверка восстановления

Минимальная проверка:

1. Создать тестовую базу.
2. Импортировать SQL.
3. Проверить, что таблицы появились.
4. Распаковать storage в тестовую папку.
5. Записать результат в `docs/OPS_TRACKER_TEMPLATE.md` или отдельный журнал.

## Частота

До публичного запуска:

- после каждого важного изменения.

После запуска:

- база — ежедневно;
- файлы — ежедневно или после появления загрузок;
- перед миграциями и обновлениями — обязательно.

## Где хранить

Минимум две копии:

- на сервере коротко;
- локально или в отдельном надежном хранилище.

Не публикуйте backups в git.
