# Текущий статус WhiteS

Дата чекпоинта: 2026-07-06.

## Публичная версия

Рабочая ссылка сейчас:

```text
https://kidai.website/whites/
```

Целевой субдомен:

```text
https://whites.kidai.website/
```

Серверная папка под будущий субдомен уже подготовлена:

```text
/home/c/cb077728/whites.kidai.website/public_html
```

Пока DNS/сайт для `whites.kidai.website` нужно создать в панели Timeweb. Инструкция: `docs/SUBDOMAIN_TIMEWEB_RU.md`.

## Что уже работает

- Статическая публичная карта `public-lite`.
- Leaflet подключен локально из `public-lite/vendor/leaflet`.
- Основной public data файл: `reports.json`.
- Fallback файл: `reports.sample.json`.
- Быстрые фильтры по типу инцидента.
- Поиск по региону, городу, оператору и сервисам.
- Мобильные вкладки `Список / Карта`, на мобильном список открывается первым.
- Счетчики отчетов, свежих отметок, регионов и проблем доступа.
- Кластеризация точек на дальнем масштабе.
- Скрытие записей без `status: published`.
- Кэш последней успешной загрузки данных в браузере.
- Без точной геолокации, авторов, телефонов, IP и сырых комментариев.
- Проектный workflow и локальный Codex skill `whites-project` для следующих итераций.
- Проведён аудит сервиса и дизайна: `docs/SERVICE_DESIGN_AUDIT_PLAN_RU.md`.
- Добавлена SEO-персона в консилиум, sitemap/robots, JSON-LD, PNG Open Graph image и PWA icons.
- Добавлена жалоба на опасную или ошибочную публичную отметку: из карточки и popup открывается безопасный Telegram-черновик для модерации.
- Рабочий intake MVP: форма отчета и жалоба могут отправляться в PHP+SQLite премодерацию на Timeweb; Telegram-черновик оставлен как резервный канал.
- Мини-админка модерации: закрытый `/admin/` с токеном из приватной папки, просмотром очереди, публикацией в `reports.json`, отклонением и закрытием жалоб.
- UX-упрощение после комиссии скептиков: честный текст премодерации, один главный CTA, список первым на мобильном, резервный текст формы спрятан под раскрывающийся блок.
- Подтверждения «Я тоже это вижу» (роадмап 1.3): кнопка на карточках и в popup, оптимистичный счётчик «N подтвердили», один голос на устройство (localStorage + бэкенд-дедуп `api/confirm.php`).
- Агрегация подтверждений в public export: при пересборке админкой `reports.json` получает базовый `confirmation_count` из `public_reports` плюс уникальные backend-подтверждения из `confirmations`.
- Privacy-safe analytics gate: `api/event.php` пишет только агрегаты `day/event/count` в `events_daily`; без cookies, IP, user-agent, user id, referrer и URL; `/admin/` показывает простую таблицу событий.
- Исполняемый mega-plan ведется в `docs/MEGA_ACTION_PLAN_RU.md`; текущий P0-порядок: confirmation export -> privacy-safe analytics -> mobile/list clarity -> regional spec -> regional generator.

## Деплой

Сборка архива:

```powershell
.\scripts\package-public-lite.ps1
```

Деплой на текущий рабочий URL:

```powershell
.\scripts\deploy-public-lite-ssh.ps1 `
  -HostName "vh464.timeweb.ru" `
  -UserName "cb077728" `
  -RemotePublicHtml "/home/c/cb077728/KidAI/public_html/whites"
```

Деплой на будущий субдомен:

```powershell
.\scripts\deploy-public-lite-ssh.ps1 `
  -HostName "vh464.timeweb.ru" `
  -UserName "cb077728" `
  -RemotePublicHtml "/home/c/cb077728/whites.kidai.website/public_html"
```

## Проверки перед деплоем

```powershell
.\scripts\validate-public-data.ps1
node --check public-lite\app.js
.\scripts\package-public-lite.ps1
```

## Следующие задачи

- Создать субдомен `whites.kidai.website` в панели Timeweb.
- Подключить SSL для субдомена.
- Улучшить модераторскую админку: поиск, фильтры, быстрые координаты по городу, бэкапы перед экспортом.
- Провести mobile/list clarity gate: 320/390/1440, CTA, warning, карточки, active filters, без horizontal overflow.
- Добавить группировку отчетов в инциденты.
- Подготовить экспорт реальных модерированных данных из Ushahidi в `reports.json`.
- Добавить страницу правил, приватности и FAQ в публичную карту.
- Использовать `docs/WORKFLOWS_AND_SKILLS_RU.md` как стартовый маршрут для каждой новой задачи.
- Продолжить P0 из `docs/SERVICE_DESIGN_AUDIT_PLAN_RU.md`: рабочий report loop и модерационный экспорт.

## Важное по безопасности

- Пароли, SMS-коды и приватные ключи не хранить в репозитории.
- В публичный JSON не добавлять авторов, точные координаты, IP, телефоны, почту и сырые вложения.
- `reports.json` должен содержать только модерированные записи.
- Приватная SQLite-база Timeweb хранится вне `public_html`: `/home/c/cb077728/KidAI/whites-data/whites.sqlite`.
- Админ-токен хранится вне `public_html`: `/home/c/cb077728/KidAI/whites-data/admin-token.txt`; в git и публичный чат его не добавлять.
