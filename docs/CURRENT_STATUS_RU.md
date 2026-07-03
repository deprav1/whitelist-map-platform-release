# Текущий статус WhiteS

Дата чекпоинта: 2026-07-03.

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
- Мобильные вкладки `Карта / Список`.
- Счетчики отчетов, свежих отметок, регионов и сбоев.
- Кластеризация точек на дальнем масштабе.
- Скрытие записей без `status: published`.
- Кэш последней успешной загрузки данных в браузере.
- Без точной геолокации, авторов, телефонов, IP и сырых комментариев.
- Проектный workflow и локальный Codex skill `whites-project` для следующих итераций.
- Проведён аудит сервиса и дизайна: `docs/SERVICE_DESIGN_AUDIT_PLAN_RU.md`.
- Добавлена SEO-персона в консилиум, sitemap/robots, JSON-LD, PNG Open Graph image и PWA icons.
- Добавлена жалоба на опасную или ошибочную публичную отметку: из карточки и popup открывается безопасный Telegram-черновик для модерации.

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
- Завершить рабочий прием “Сообщить о проблеме” в премодерацию.
- Добавить режим “у меня тоже / восстановилось” без логина.
- Добавить группировку отчетов в инциденты.
- Подготовить экспорт реальных модерированных данных из Ushahidi в `reports.json`.
- Добавить страницу правил, приватности и FAQ в публичную карту.
- Использовать `docs/WORKFLOWS_AND_SKILLS_RU.md` как стартовый маршрут для каждой новой задачи.
- Продолжить P0 из `docs/SERVICE_DESIGN_AUDIT_PLAN_RU.md`: рабочий report loop и модерационный экспорт.

## Важное по безопасности

- Пароли, SMS-коды и приватные ключи не хранить в репозитории.
- В публичный JSON не добавлять авторов, точные координаты, IP, телефоны, почту и сырые вложения.
- `reports.json` должен содержать только модерированные записи.
