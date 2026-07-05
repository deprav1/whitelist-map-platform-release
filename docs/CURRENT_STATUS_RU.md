# Текущий статус Где белые списки?

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

В эту папку также выложена текущая сборка `20260705-offline3`; публично она откроется после создания сайта/DNS/SSL в Timeweb.

Пока DNS/сайт для `whites.kidai.website` нужно создать в панели Timeweb. Инструкция: `docs/SUBDOMAIN_TIMEWEB_RU.md`.

## Что уже работает

- Статическая публичная карта `public-lite`.
- Leaflet подключен локально из `public-lite/vendor/leaflet`; на мобильном первом экране JS карты грузится лениво только при открытии вкладки `Карта`.
- Основной public data файл: `reports.json`.
- Fallback файл: `reports.sample.json`.
- Быстрые фильтры по типу инцидента.
- Поиск по региону, городу, оператору и сервисам.
- Мобильные вкладки `Карта / Список`.
- Счетчики отчетов, свежих отметок, регионов и сбоев.
- Кластеризация точек на дальнем масштабе.
- Скрытие записей без `status: published`.
- Кэш последней успешной загрузки данных в браузере.
- Если карта открылась из кэша или встроенного резерва, бейдж источника и пояснение в шапке списка показывают это явно.
- Состояние данных вынесено в отдельную панель: живые/демо, кэш, резервный набор и действия `Обновить`, `Очистить кэш`, `Сообщить наблюдение`.
- Локальный блок "Ваша ситуация" по выбранным региону и оператору.
- Для блока "Ваша ситуация" можно сохранить до пяти локальных мест: регион/оператор хранятся только в браузере и применяются одним нажатием.
- Карточки и блок "Ваша ситуация" показывают вычисляемый статус ситуации: `Активно`, `Разные отметки`, `Восстанавливается`, `Восстановлено`, `Устарело`.
- В карточке отчета есть действие "Показать на карте"; на мобильном оно переключает пользователя из списка на карту и выделяет точку.
- Первый экран перестроен в оперативную сводку: активные инциденты, свежие отметки, восстановления и общее число опубликованных отметок.
- В списке есть единый блок "Сводка": инциденты выше отдельных отметок, затем регионы и операторы. Группировка вычисляется по опубликованным отметкам и не меняет публичный `reports.json`.
- В списке есть low-bandwidth панель: пользователь видит, что список, фильтры, сводка и форма работают без внешних тайлов; из нее можно открыть карту, сообщить наблюдение или поделиться текущим видом.
- Мобильный список, сводка, фильтры, блок "Ваша ситуация" и форма доступны без обязательной загрузки Leaflet JS.
- На мобильном в списке нижняя sticky-панель появляется только при активных фильтрах; фильтры можно снять по одному или кнопкой `сбросить все`, а `Сообщить` остается доступным в панели.
- Пустые состояния различают полный ноль опубликованных данных и отсутствие результатов по фильтрам; оба состояния дают безопасное следующее действие и ссылку к объяснению данных.
- Первый экран показывает короткие trust-cues: без регистрации, премодерация, неофициальные отметки.
- Диалог "О данных" содержит вкладки `Данные`, `Правила`, `Приватность`, `Безопасность` с короткими публичными правилами и safety-текстами.
- Добавлена отдельная публичная FAQ-страница `public-lite/faq.html` с правилами, приватностью, жалобами, low-bandwidth режимом и безопасным примером отправки.
- Добавлены отдельные публичные страницы `public-lite/rules.html` и `public-lite/privacy.html`; они кэшируются read-only offline-shell вместе с FAQ.
- Кнопка `Поделиться` открывает безопасный share-dialog: готовит нейтральный текст и URL текущих публичных фильтров без локальных “моих мест” и черновиков.
- Кнопки "У меня тоже", "Восстановилось" и "Пожаловаться" отправляют наблюдение в премодерацию, если доступен `api/observations.php`.
- Жалоба на опубликованную отметку требует причину: персональные данные, точный адрес/опасная геоточка, риск для человека, ошибка, дубль, устарело или другое.
- Форма отправки требует safety-подтверждение: без личных данных, точного адреса, GPS, приватных ссылок и VPN/proxy-инструкций; inline-подсказка предупреждает о рискованных паттернах до отправки.
- Endpoint `api/observations.php` помечает risky pending-записи полями `risk_level`, `risk_flags` и `review_priority`, но эти поля не попадают в публичный `reports.json`.
- Добавлен `scripts/audit-public-data-safety.ps1`: отдельная проверка публичного JSON на запрещенные поля, контакты, ссылки, IP, точные координаты, адресные маркеры и VPN/proxy-инструкции.
- `scripts/export-moderated-observations.ps1` и `scripts/package-public-lite.ps1` автоматически запускают public-data safety audit перед записью или упаковкой публичных данных.
- Публичный JSON поддерживает `export_manifest`: `schema_version`, `record_count`, `generated_at`, `generated_from_moderation_revision`; валидатор проверяет совпадение `record_count` с числом отчетов.
- Добавлены внутренние модераторские кейсы `data/moderation-test-cases.json` и проверка `scripts/check-moderation-test-cases.ps1`; упаковка public-lite запускает эту проверку вместе с public-data audit.
- Если PHP endpoint недоступен, форма оставляет безопасный черновик для ручной отправки.
- Pending-очередь приема хранится отдельно от публичного `reports.json`.
- Модераторский экспорт pending-наблюдений в `reports.json` доступен через `scripts/export-moderated-observations.ps1`; для жалоб поддержаны решения `hide_report` и `edit_report`.
- Optional `api/context.php` может вернуть только явно настроенную подсказку региона, без IP-геолокации.
- `public-lite/sw.js` включает read-only offline-shell: кэширует публичную оболочку, FAQ, правила, приватность, локальные Leaflet-ассеты и fallback JSON; `api/`, `submissions/`, POST-запросы и внешние тайлы не кэшируются.
- Добавлен `scripts/check-public-lite-live.ps1`: read-only проверка live URL, FAQ, service worker, `reports.json`, `api/context.php`, закрытой pending-очереди, TLS-срока и safety audit live JSON.
- `scripts/deploy-public-lite-ssh.ps1` чистит известные старые публичные хвосты (`admin`, старые `api/*`, старые `icons/manifest/share/og/sitemap`) с серверным архивом в `$HOME/whites-stale-backups`.
- Рабочий URL `https://kidai.website/whites/` обновлен и проверен после деплоя: страница отдает новый cache-buster, `api/context.php` возвращает JSON, `api/observations.php` принимает валидный тестовый POST, `submissions/observations-pending.jsonl` закрыт для прямого чтения.
- Без точной геолокации, авторов, телефонов, IP и сырых комментариев.

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
.\scripts\audit-public-data-safety.ps1 -Path public-lite\reports.json
.\scripts\check-moderation-test-cases.ps1
node --check public-lite\app.js
.\scripts\check-public-lite-live.ps1
.\scripts\package-public-lite.ps1
```

## Следующие задачи

- Продолжить план радикального улучшения из `docs/RADICAL_PRODUCT_IMPROVEMENT_PLAN_RU.md`: уточнить тексты после появления реальных данных.
- Создать субдомен `whites.kidai.website` в панели Timeweb.
- Подключить SSL для субдомена.
- Проверить модераторский экспорт на реальных pending-наблюдениях, когда они появятся.
- Добавить серверную/экспортную сущность инцидента, когда появятся реальные модерированные дубли.
- Подготовить экспорт реальных модерированных данных из Ushahidi в `reports.json`.
- Доработать FAQ по реальным вопросам пользователей после запуска.

## Чекпоинт остановки

Пауза работы: 2026-07-06.

Последний опубликованный live-релиз на `https://kidai.website/whites/`:

- cache-buster `20260705-offline3`;
- lazy-load Leaflet на мобильном первом экране;
- блок "Ваша ситуация" с локальными "моими местами";
- trust-cues на первом экране: без регистрации, премодерация, неофициальные отметки;
- low-bandwidth панель с действиями `Открыть карту`, `Сообщить`, `Поделиться`;
- sticky-панель активных фильтров появляется только при активных фильтрах и содержит `сбросить все` при нескольких фильтрах;
- inline safety-подсказка формы предупреждает о рискованных паттернах до отправки;
- безопасный share-dialog без локальных настроек в ссылке;
- отдельная FAQ-страница `faq.html`;
- отдельные страницы `rules.html` и `privacy.html`;
- public data `export_manifest` со схемой `1.1` и `record_count`;
- read-only offline-shell `sw.js`, который кэширует только публичную оболочку, FAQ, правила, приватность, fallback JSON и локальные Leaflet-ассеты;
- `api/`, `submissions/`, POST-запросы, pending-очередь и внешние тайлы не кэшируются.

Последние проверки перед паузой:

```powershell
.\scripts\run-public-lite-preflight.ps1 -IncludeLiveCheck -IncludeBackup
.\scripts\deploy-public-lite-ssh.ps1 -HostName "vh464.timeweb.ru" -UserName "cb077728" -RemotePublicHtml "/home/c/cb077728/KidAI/public_html/whites"
.\scripts\deploy-public-lite-ssh.ps1 -HostName "vh464.timeweb.ru" -UserName "cb077728" -RemotePublicHtml "/home/c/cb077728/whites.kidai.website/public_html"
.\scripts\check-public-lite-live.ps1 -CheckExtendedPages -ExpectedCacheName "whites-public-lite-offline3"
```

Live-smoke подтвержден: главная, FAQ, правила и приватность отдают `200`; `sw.js` содержит `whites-public-lite-offline3`; `api/context.php` возвращает JSON; `api/observations.php` на GET отвечает `405`; `submissions/observations-pending.jsonl` закрыт `403`; live `reports.json` проходит validation и safety audit, manifest `record_count=10` совпадает с числом записей. Browser-smoke на live подтвердил мобильный список 390px, desktop 1440px, trust-cues, sticky-фильтры с `сбросить все` и видимую risk-подсказку формы.

Контроль 2026-07-06: `.\scripts\check-public-lite-live.ps1 -CheckExtendedPages -ExpectedCacheName "whites-public-lite-offline3"` и `.\scripts\run-public-lite-preflight.ps1 -IncludeLiveCheck -CheckExtendedLivePages -ExpectedCacheName "whites-public-lite-offline3"` прошли успешно. DNS для `whites.kidai.website` все еще не создан, cutover зависит от панели Timeweb.

## Важное по безопасности

- Пароли, SMS-коды и приватные ключи не хранить в репозитории.
- В публичный JSON не добавлять авторов, точные координаты, IP, телефоны, почту и сырые вложения.
- `reports.json` должен содержать только модерированные записи.
