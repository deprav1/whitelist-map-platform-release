# Локальная карта проекта WhiteS

Основная папка проекта на этой машине:

```text
C:\Users\Lenovo\Desktop\PROEKTZ\WhiteS
```

Это git-репозиторий `deprav1/whitelist-map-platform-release`, ветка `main`.

## Что где лежит

- `public-lite/` - текущий публичный легкий фронтенд карты. Это то, что выкладывается на Timeweb.
- `public-lite/index.html` - структура страницы: шапка, карта, список отчетов, модалки.
- `public-lite/styles.css` - весь дизайн публичной карты.
- `public-lite/app.js` - логика карты, фильтров, списка, черновика отчета и мобильного режима.
- `public-lite/reports.json` - текущий публичный экспорт модерируемых отметок, который видит карта.
- `data/public-reports.sample.json` - эталонный пример безопасного публичного JSON.
- `docs/` - продуктовые планы, workflow, безопасность, модерация, деплой, доступы и эксплуатация.
- `scripts/` - локальные PowerShell-скрипты для упаковки, проверки и деплоя.
- `tmp/` - временные архивы сборки. В git не нужен.
- `config/` - настройки формы и категорий для будущего полного Ushahidi/Docker-варианта.
- `deploy/` - заготовки для хостинга и будущего VPS/Fly.io.

## Самые важные команды

Проверить публичные данные:

```powershell
.\scripts\validate-public-data.ps1
```

Собрать ZIP для ручной загрузки через файловый менеджер Timeweb:

```powershell
.\scripts\package-public-lite.ps1
```

Выложить текущую карту на рабочий URL через SSH:

```powershell
.\scripts\deploy-public-lite-ssh.ps1 -HostName 'vh464.timeweb.ru' -UserName 'cb077728' -RemotePublicHtml '/home/c/cb077728/KidAI/public_html/whites'
```

Выложить ту же сборку в папку будущего субдомена:

```powershell
.\scripts\deploy-public-lite-ssh.ps1 -HostName 'vh464.timeweb.ru' -UserName 'cb077728' -RemotePublicHtml '/home/c/cb077728/whites.kidai.website/public_html'
```

## Публичные адреса

Сейчас рабочая публикация:

```text
https://kidai.website/whites/
```

Будущий субдомен:

```text
https://whites.kidai.website/
```

Субдомен начнет открываться после создания в панели Timeweb и включения SSL.

## SSH

SSH-доступ настроен ключом:

```text
C:\Users\Lenovo\.ssh\whites_timeweb_ed25519
```

Публичная инструкция без приватного ключа:

```text
docs\SSH_ACCESS_RU.md
```

## GitHub

Remote:

```text
https://github.com/deprav1/whitelist-map-platform-release.git
```

Проверить состояние:

```powershell
git status --short --branch
```

Запушить `main`, если изменения уже закоммичены:

```powershell
git push origin main
```

## Codex skills

Локальный проектный skill для будущих итераций:

```text
C:\Users\Lenovo\.codex\skills\whites-project
```

Использовать его для задач по UX, данным, модерации, деплою, roadmap и handoff между агентами.

Документированная версия workflow в репозитории:

```text
docs\WORKFLOWS_AND_SKILLS_RU.md
```

## Что редактировать чаще всего

- Текст и структура интерфейса: `public-lite/index.html`.
- Внешний вид: `public-lite/styles.css`.
- Поведение карты и фильтров: `public-lite/app.js`.
- Публичные записи карты: `public-lite/reports.json` и затем синхронизация с безопасным экспортом.
- Продуктовый план UX: `docs/UX_PRODUCT_PLAN_RU.md`.
- Workflow и skills: `docs/WORKFLOWS_AND_SKILLS_RU.md`.
- Аудит сервиса и дизайна: `docs/SERVICE_DESIGN_AUDIT_PLAN_RU.md`.
- Текущий статус и деплой: `docs/CURRENT_STATUS_RU.md`.
