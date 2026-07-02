# Публикация public-lite на Timeweb без SSH

Эта инструкция для статической карты `public-lite`, когда доступен только файловый менеджер Timeweb.

## 1. Собрать архив локально

Из корня репозитория запустите:

```powershell
.\scripts\package-public-lite.ps1
```

Скрипт:

- проверит `data/public-reports.sample.json` через `scripts/validate-public-data.ps1`;
- соберет `tmp/whites-public-lite.zip` из содержимого папки `public-lite`;
- напечатает следующие шаги для загрузки.

Если валидация JSON упала, архив не обновляйте на сервере: сначала исправьте публичные данные.

## 2. Очистить старые файлы в public_html

В панели Timeweb откройте файловый менеджер сайта и перейдите в `public_html`.

Перед загрузкой нового архива удалите старые файлы статической карты:

- `index.htm`, если он остался от старой заглушки или предыдущей публикации;
- старые `index.html`, `app.js`, `styles.css`, `reports.sample.json`;
- старый `reports.json`, если обновляете демо-данные новым архивом;
- старую папку `vendor` или `vendor/leaflet` от предыдущей версии карты;
- старый `.htaccess`, если он был от предыдущей версии этой карты;
- старый `README.md`, если он был распакован рядом с сайтом.

Не удаляйте файлы, которые не относятся к этой статической карте, если в `public_html` лежит что-то еще.

## 3. Загрузить и распаковать zip

1. Загрузите `tmp/whites-public-lite.zip` в `public_html`.
2. Выберите архив в файловом менеджере Timeweb и нажмите распаковку.
3. Проверьте, что файлы распаковались прямо в `public_html`, а не в дополнительную папку.

После распаковки должны быть видны:

- `public_html/index.html`;
- `public_html/.htaccess`;
- `public_html/app.js`;
- `public_html/styles.css`;
- `public_html/robots.txt`;
- `public_html/reports.json`;
- `public_html/reports.sample.json`;
- `public_html/vendor/leaflet/leaflet.css`;
- `public_html/vendor/leaflet/leaflet.js`;
- `public_html/vendor/leaflet/images/marker-icon.png`.

Если `vendor/leaflet` отсутствует, карта не сможет загрузить Leaflet и останется без интерактивной карты.

Для живых данных заменяйте `public_html/reports.json`. Карта читает его первым. Если его нет, она покажет `reports.sample.json`.

## 4. Проверить в браузере

Откройте сайт по домену и нажмите `Ctrl+F5`, чтобы сбросить кеш браузера.

Проверьте:

- открывается новая карта, а не старая `index.htm`-страница;
- фильтры и список отчетов работают;
- в сетевых запросах нет 404 на `vendor/leaflet/leaflet.css` и `vendor/leaflet/leaflet.js`;
- маркеры появляются на карте.

После успешной проверки zip-файл в `public_html` можно удалить, чтобы он не лежал в публичном доступе.
