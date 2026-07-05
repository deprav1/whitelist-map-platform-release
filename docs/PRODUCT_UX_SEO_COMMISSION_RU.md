# Комиссия product/UX/design/SEO WhiteS

Дата: 2026-07-06.

Цель комиссии: скорректировать 2-месячный план так, чтобы WhiteS рос не как набор фич, а как удобный, безопасный и индексируемый аварийный продукт. Комиссия не отменяет красные линии из `docs/CONSILIUM_AND_DEVELOPMENT_PLAN_RU.md`; она превращает их в рабочий фильтр для product, UX, дизайна, SEO и агентов-исполнителей.

## Роли комиссии

### Product lead

Фокус: главный пользовательский цикл `увидел -> понял -> сообщил/подтвердил -> поделился`.

Вето:

- фичи, которые не улучшают один из шагов цикла;
- большие релизы без измеримого результата;
- работа "на будущее", если не закрыт текущий report/confirm/share loop.

### UX lead

Фокус: мобильный сценарий 390px, плохая сеть, форма, карточка, фильтры, доступность CTA.

Вето:

- горизонтальный скролл, обрезанные кнопки, мелкие touch targets;
- больше двух основных действий на карточке;
- SEO или growth-блоки, которые вытесняют аварийный ответ с первого экрана.

### Visual design lead

Фокус: тёмная тема, контраст, узнаваемость, скриншот-готовность, без ощущения "сломалась карта".

Вето:

- декоративные блоки без функции;
- слабый контраст формы, модалок, chips и empty states;
- новые визуальные стили, не продолжающие текущую систему.

### SEO/growth lead

Фокус: региональные страницы, sitemap, OG, deep-links, structured data, Search Console.

Вето:

- индексация сырых, точных или непроверенных данных;
- страницы по точному адресу, человеку, месту работы, маршруту или опасной геоточке;
- SEO-тексты с обещаниями "официально", "безопасно", "обход", VPN/proxy-инструкциями.

### Trust/safety lead

Фокус: минимизация вреда, приватность, риск формулировок, безопасная аналитика.

Вето:

- cookies, рекламные пиксели и внешняя аналитика;
- хранение IP/user-agent как пользовательских идентификаторов;
- публичные страницы, раскрывающие больше, чем карта.
- трактовка OG, share preview или embed как "технического" слоя без public-data gate;
- auto-publish/auto-reject safety-sensitive данных без человеческой модерации.

### Data/moderation lead

Фокус: public data contract, экспорт, дедупликация, confirmations, complaints, rollback.

Вето:

- `reports.json` с pending/private/rejected/internal fields;
- региональные страницы без validation/safety audit источника;
- счетчики подтверждений, которые нельзя объяснить или пересобрать.

### Infra/release lead

Фокус: Timeweb, deploy, rollback, tests, cache, service worker, subdomain cutover.

Вето:

- deploy без preflight и live-smoke;
- изменение JS/CSS/SW без cache/version bump;
- включение `whites.kidai.website` без DNS/SSL/cutover-проверки.

## Коррекция 2-месячного плана

### Главная правка

Фаза C SEO важна, но не должна идти первой. Сначала нужно замкнуть доверие к данным, иначе региональные страницы будут масштабировать неполную картину.

Новый порядок:

1. confirmation aggregation в публичный экспорт;
2. privacy-safe measurement gate;
3. mobile form/list clarity gate;
4. safety spec для региональных страниц;
5. генерация региональных страниц из уже опубликованного `reports.json`;
6. sitemap/Search Console;
7. UX/design polish по фактическим входам с этих страниц.

Не надо строить "SEO-лендинг". Региональная страница - это текстовый аварийный снимок региона и путь обратно в карту.

### P0 на ближайшие 2 недели

1. **Confirmation aggregation**: замкнуть счетчики подтверждений из backend в публичный экспорт.
   Готово: `reports.json` получает `confirmation_count = base + COUNT(confirmations)`; повторный голос с одного устройства не увеличивает счетчик; после rebuild счетчик виден всем; есть тест на агрегацию.

2. **Private analytics gate**: добавить только cookieless/self-hosted counters или локальный SQLite event counter без IP, UA, cookies и user id.
   Готово: видны `share_clicked`, `confirm_clicked`, `report_submitted`, `deeplink_open`, `region_page_view`; внешних трекеров нет; страница не замедлилась.

3. **Mobile form/list clarity**: проверить форму, первый экран и список перед новым входящим SEO-трафиком.
   Готово: Playwright screenshots 390x844, 320px и 1440x900; поля формы, warning и CTA видимы; touch targets >= 44px; время проверки объяснено.

4. **Regional pages safety spec**: зафиксировать шаблон `/r/<region-slug>/`, поля, JSON-LD и запреты до генератора.
   Готово: один шаблон, один slug contract, нет точных мест, нет raw summary, только агрегаты.

5. **Regional page generator**: генерировать статические страницы из `reports.json`, добавлять их в sitemap, связывать с картой `?region=`.
   Готово: страницы 200, JSON-LD валиден, `reports.json` убран из sitemap, e2e покрывает хотя бы один регион.

6. **Mobile UX/design gate for every release**: не отдельная "неделя красоты", а обязательный gate для SEO/analytics/confirmation изменений.
   Готово: Playwright screenshots 390x844 и 1440x900, touch targets >= 44px, без перекрытий.

### P1 после P0

- `/media.html` и embed-виджет для каналов, только после работающих региональных страниц и событий.
- PWA install prompt после успешного отчета, только после report loop metrics.
- История восстановления, когда появятся реальные повторные события.

## SEO-правила

- Индексировать только безопасные агрегаты из `status: published`.
- SEO/OG/embed считаются публичной публикацией: только модерированные поля, никакого raw text, `source_url`, вложений, точных мест, внутренних id.
- Не индексировать per-report/share URLs: `?report=`, `share.php`, API и `/admin/` не попадают в sitemap.
- Если региональная страница фактически раскрывает один узнаваемый район+оператор+сервис кейс, страница должна быть обобщенной или не публиковаться.
- `title`: что происходит в регионе, без паники и обещаний.
- `description`: свежесть, типы проблем, что данные пользовательские и модерируемые.
- JSON-LD: `WebPage`/`Dataset`/`ItemList`, без точных координат и сырых комментариев. `SpecialAnnouncement` не использовать как DoD-цель: он может выглядеть как официальный emergency-сигнал и больше не является надежной rich-result целью.
- `canonical`: региональная страница канонична для своего slug.
- `robots.txt`: sitemap обязателен; admin/api/submissions закрыты.
- `sitemap.xml`: главная, FAQ/media/rules/privacy, региональные страницы; не включать `reports.json`.
- OG: использовать `api/og.php?region=<slug>`; fallback не должен раскрывать больше текста, чем HTML.
- Динамические OG и embed должны иметь rollback/takedown путь до публикации, потому что мессенджеры кэшируют превью.

## UX/design правила

- Первый экран SPA остается инструментом, не лендингом.
- На карточке отчета максимум два основных действия; остальное в раскрытие или вторичный стиль.
- Любая новая SEO/growth ссылка должна вести к понятному действию: открыть карту региона, сообщить, подтвердить, поделиться.
- Empty states должны давать следующее действие, но не утверждать "проблемы нет".
- Цвет не единственный носитель смысла; статус нужен текстом.

## Skills и workflow для агента

Обязательные skills:

- `whites-project` - перед любой задачей в WhiteS;
- `playwright` - для UX/design, regional pages visual QA, live smoke через браузер;
- `security-best-practices` - только при явном security review JS/PHP;
- `skill-creator` - если проектные skills надо разделить на `whites-seo-growth`, `whites-release-ops`, `whites-moderation`.

Обязательные workflow:

1. **Commission intake**: прочитать `docs/AGENT_PLAN_2M_RU.md`, `docs/PRODUCT_UX_SEO_COMMISSION_RU.md`, `docs/WORKFLOWS_AND_SKILLS_RU.md`.
2. **Slice definition**: один release = одна пользовательская ценность + один измеримый критерий.
3. **Safety gate**: public data validation + safety audit, если источник - `reports.json`.
4. **UX/design gate**: 390x844 + 1440x900 screenshots для любых видимых изменений.
5. **SEO gate**: title/description/canonical/OG/JSON-LD/sitemap/robots проверены без PII.
6. **PHP gate**: для измененных `public-lite/api/*.php`, `public-lite/admin/*.php`, `share.php` выполнить syntax check.
7. **Release gate**: tests, package, deploy, live-check, docs update.
8. **Post-release note**: что изменилось, как измеряется, какой следующий риск.

## Что нельзя делать ближайшие 2 месяца

- Регистрация, телефоны, email, личные кабинеты.
- Точная геолокация или кнопка "определить меня" без отдельного threat model.
- Внешние трекеры, cookies, рекламные пиксели, сегментация пользователей.
- Auto-post в Telegram/каналы без человека-модератора.
- Публичный read API/CSV шире текущего безопасного JSON.
- Динамические `/r/` на лету и любые SEO-страницы ниже безопасного регионального агрегата.
- Сбор или публикация пользовательских скриншотов.
- Переписывание на фреймворк, SSR, сборщик или новую архитектуру.
- Web Push, Mini App, бот-диалоги и канал-автоматизация до появления живых метрик.
- Фичи "на вырост", которые увеличивают поверхность риска быстрее, чем растет аудитория.

## Decision log

```text
Дата:
Инициатор:
Срез плана:
Product verdict:
UX/design verdict:
SEO verdict:
Trust/safety verdict:
Data/moderation verdict:
Infra/release verdict:
Итоговый P0/P1:
Файлы:
Проверки:
Deploy нужен:
Дата пересмотра:
```
