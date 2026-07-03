# Статус деплоя WhiteS

Дата: 2026-07-03

## Что опубликовано

- Рабочий публичный URL: https://kidai.website/whites/
- Проверка после деплоя: HTTP 200.
- Версия фронтенда в HTML: `app.js?v=20260703-ux`.
- Версия Service Worker cache: `whites-v4`.
- Архив для ручной загрузки: `tmp/whites-public-lite.zip`.

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

Итог E2E: `104 passed`.
