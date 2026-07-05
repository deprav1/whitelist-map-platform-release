# Субдомен Где белые списки? на Timeweb

Целевой субдомен:

```text
whites.kidai.website
```

Файлы уже подготовлены на сервере:

```text
/home/c/cb077728/whites.kidai.website/public_html
```

## Что сделать в панели Timeweb

1. Открыть раздел **Сайты**.
2. Нажать **Создать сайт** или **Добавить сайт**.
3. Выбрать тип **Поддомен**.
4. Указать:

```text
whites.kidai.website
```

5. Если панель спросит папку сайта, выбрать или указать:

```text
whites.kidai.website/public_html
```

6. После создания открыть:

```text
https://whites.kidai.website/
```

DNS может обновляться не сразу. Обычно это минуты, иногда дольше.

## Временный рабочий URL

Пока субдомен не создан в панели, карта уже доступна здесь:

```text
https://kidai.website/whites/
```

## Повторный деплой на субдомен

```powershell
.\scripts\deploy-public-lite-ssh.ps1 `
  -HostName "vh464.timeweb.ru" `
  -UserName "cb077728" `
  -RemotePublicHtml "/home/c/cb077728/whites.kidai.website/public_html"
```

## Проверка после создания субдомена

```powershell
Resolve-DnsName whites.kidai.website
Invoke-WebRequest -UseBasicParsing https://whites.kidai.website/
```

После создания DNS и SSL можно прогнать общую warning-only проверку из репозитория:

```powershell
.\scripts\check-public-lite-live.ps1 -CheckFutureSubdomain
```

Критерий готовности для переключения людей на новый адрес:

```powershell
.\scripts\check-public-lite-live.ps1 `
  -BaseUrl "https://whites.kidai.website/" `
  -CheckExtendedPages `
  -ExpectedCacheName "whites-public-lite-offline3"
```

Эта проверка должна подтвердить главную, FAQ, правила, приватность, `sw.js`, `reports.json`, `api/context.php`, закрытую pending-очередь, TLS и safety audit публичного JSON. Если нужно проверить текущий рабочий URL и будущий субдомен одной командой:

```powershell
.\scripts\run-public-lite-preflight.ps1 `
  -IncludeLiveCheck `
  -CheckExtendedLivePages `
  -ExpectedCacheName "whites-public-lite-offline3" `
  -IncludeFutureSubdomainCheck `
  -FailOnFutureSubdomainIssues
```
