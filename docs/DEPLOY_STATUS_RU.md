# Статус деплоя WhiteS

Дата: 2026-07-03

## Что опубликовано

- Рабочий публичный URL: https://kidai.website/whites/
- Проверка после деплоя: HTTP 200.
- Версия фронтенда в HTML: `app.js?v=20260703-storage`.
- Версия CSS в HTML: `styles.css?v=20260703-storage`.
- Версия Service Worker cache: `whites-v9`.
- SEO/PWA: опубликованы `sitemap.xml`, `robots.txt` с sitemap, JSON-LD, `og-image.png`, PNG icons 192/512 + maskable.
- Safety UX: опубликована кнопка жалобы на публичную отметку в карточках и popup; жалоба формируется как Telegram-черновик без запроса контактов.
- Storage MVP: опубликован `public-lite/api/` для приема отчетов и жалоб в приватную SQLite-базу Timeweb с резервным Telegram-черновиком.
- Moderation MVP: опубликован закрытый `/admin/` для просмотра очередей, публикации безопасных записей и пересборки `reports.json`.
- Публичные формулировки используют только рабочий статус модерируемых данных.
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

Итог E2E: `105 passed`.
