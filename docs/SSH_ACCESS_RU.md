# SSH-доступ для публикации WhiteS

Безопасный вариант: не передавать пароль от панели/FTP, а добавить отдельный публичный SSH-ключ.

## 1. Ключ уже создан локально

Публичный ключ:

```text
C:\Users\Lenovo\.ssh\whites_timeweb_ed25519.pub
```

Приватный ключ:

```text
C:\Users\Lenovo\.ssh\whites_timeweb_ed25519
```

Приватный ключ никуда не отправлять и не вставлять в чат. На сервер или в панель добавляется только `.pub`.

## 2. Что добавить в Timeweb

Открой содержимое публичного ключа:

```powershell
Get-Content $env:USERPROFILE\.ssh\whites_timeweb_ed25519.pub
```

Скопируй всю строку, которая начинается с:

```text
ssh-ed25519
```

Дальше зависит от тарифа:

- Timeweb Cloud/VPS: добавить ключ в разделе SSH-ключей или в доступах сервера.
- Обычный виртуальный хостинг: сначала включить SSH-доступ в панели. Если панели для ключей нет, нужно один раз зайти по паролю и добавить строку в `~/.ssh/authorized_keys`.

## 3. Какие данные можно дать мне

Без пароля:

- SSH host;
- SSH port, обычно `22`;
- SSH login;
- путь до корня сайта, например `~/Gdeinet/public_html` или `~/public_html`.

Пароль, код из SMS, пароль панели, приватный ключ и платежные данные не присылать.

## 4. Проверка доступа

После добавления ключа:

```powershell
ssh -i $env:USERPROFILE\.ssh\whites_timeweb_ed25519 -p 22 login@host
```

При первом входе нужно подтвердить fingerprint сервера словом `yes`.

## 5. Деплой статической карты

Когда SSH работает:

```powershell
.\scripts\deploy-public-lite-ssh.ps1 -HostName "host" -UserName "login" -RemotePublicHtml "~/Gdeinet/public_html"
```

Скрипт соберет `tmp/whites-public-lite.zip`, загрузит на сервер, распакует в `public_html` и покажет список ключевых файлов.
