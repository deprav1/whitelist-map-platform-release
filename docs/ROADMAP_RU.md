# Где белые списки? roadmap

Где белые списки? should become a practical public utility for people in Russia who face mobile internet shutdowns, whitelist-only mode, censorship, throttling, and random service outages.

The product should feel calm and useful, not performative. The core promise is simple: quickly understand what works nearby, what does not, how fresh the information is, and how to report safely without exposing yourself.

## Current State Assessment

What is already done:

- Ushahidi Platform Release is selected as the backend/admin base.
- Docker Compose local setup is prepared.
- Timeweb shared-hosting packaging path is prepared.
- Fly.io deployment path is prepared as an alternative.
- The report form covers region, operator, network type, problem type, checked services, whitelist status, time, confidence, source, comment, map point, and incident category.
- Moderation is enabled at the survey level.
- Product, database, Timeweb, and hosting notes exist in `docs/`.

Main gaps before public beta:

- The default Ushahidi public UI may be too heavy and too generic for Russian users on unstable internet.
- No tested deployment yet on Timeweb or Docker because there is no current hosting/SSH access.
- No lightweight public read-only frontend yet.
- Anti-spam and duplicate handling are not implemented beyond manual moderation.
- Privacy promises are currently product rules, not fully enforced in code.
- No city/region/service landing pages for search and sharing.
- No backup/restore drill.
- No moderator checklist or operating routine.

## Lessons From GdeBenz

The useful logic to adapt:

- Map-first experience: the first screen answers the urgent question immediately.
- Safety framing: "nothing to download", "no registration", "no personal data".
- Clear disclaimer: reports are user-submitted, subjective, fresh-or-stale, and not official facts.
- One-tap contribution: user can add a status with minimum friction.
- Freshness and confidence: users need to see whether a report is recent and trusted.
- Nearby mode: the product should answer "what works near me" without saving exact GPS.
- Local-only favorites: saved places should live on the device, not the account.
- Share loop: "send to people nearby" is part of data quality.
- External route/action links: for us this means links to maps, official status pages, or instructions, not internal complexity.
- SEO/content surface: city, region, operator, and problem pages bring users from search during crisis spikes.
- Community rules/legal pages: privacy policy, user agreement, report rules, and fraud/safety warning build trust.

What must be different for Где белые списки?:

- More sensitive threat model: location, identity, and political interpretation are risky.
- Stronger moderation: false reports can cause harm and panic.
- Approximate location by default; exact GPS should not be required.
- Avoid advice that could be interpreted as evasion instructions or expose users.
- Public data must not include author identifiers or raw metadata.

## Core User Scenarios

### 1. Person With Broken Mobile Internet

Goal: understand whether the outage is local, operator-specific, or widespread.

Flow:

1. Opens "Где белые списки?"
2. Sees nearby/selected region status without login.
3. Filters by operator and network type.
4. Checks freshness and confidence.
5. Shares the page with family or local chat.

Success criteria:

- Page opens on slow connection.
- Current region status is visible in under 3 seconds after load.
- No account, app download, or exact location is required.

### 2. Person Reporting a Problem

Goal: add a useful anonymous report quickly.

Flow:

1. Taps "Сообщить".
2. Chooses region/city or approximate point.
3. Chooses operator, network type, problem type, checked services, time, confidence.
4. Sees safety warning before free-text comment.
5. Submits to moderation.

Success criteria:

- Report takes under 60 seconds.
- Form actively discourages personal data.
- User understands that report appears after moderation.

### 3. Moderator

Goal: keep the public map useful without exposing users.

Flow:

1. Reviews pending reports.
2. Removes personal data from comments.
3. Rejects panic, doxxing, exact-address reports, duplicates, spam, and political bait.
4. Merges or marks duplicates.
5. Publishes verified/usable report.

Success criteria:

- Moderator can process a report in under 30 seconds.
- Every published report has approximate location, timestamp, category, and confidence.

### 4. Returning User

Goal: quickly check important places.

Flow:

1. Opens "Мои места".
2. Sees locally saved regions/operators.
3. Checks status without account.

Success criteria:

- Saved places are stored only in browser local storage.
- No server-side profile is created.

### 5. Researcher / Journalist / Community Admin

Goal: understand regional patterns without exposing users.

Flow:

1. Opens public region/operator pages.
2. Uses CSV/JSON export of moderated public reports.
3. Sees methodology and limitations.

Success criteria:

- Export contains no author metadata.
- Public disclaimers clearly state that data is crowdsourced and not official.

## Product Pillars

### Safety First

- No required registration.
- No required exact GPS.
- No phone/email/name fields.
- No public author metadata.
- Warnings before comments and uploads.
- Basic fraud warning: Где белые списки? does not sell access, ask for payment, require apps, or collect login/passwords.

### Freshness Over Completeness

- Every public report needs a clear "checked at" time.
- Old reports fade visually.
- Default filters should prioritize fresh reports.
- Status pages should show "last confirmed" and "last conflicting report".

### Calm Utility

- No alarmist language.
- No political slogans in the product UI.
- Practical labels: "работает", "частично", "только белый список", "не работает", "восстановлено".

### Low-Bandwidth First

- No heavy third-party widgets.
- No external fonts.
- Static fallback pages for region/operator status.
- PWA cache after MVP.
- Read-only public frontend later, using Ushahidi as backend/admin.

## Roadmap

### Phase 0: Deployable Beta

Goal: get the current Ushahidi-based MVP online on Timeweb.

Tasks:

- Build Timeweb shared-hosting package.
- Upload via SSH when access is available.
- Configure Timeweb MySQL.
- Run migrations.
- Configure cron.
- Run `bootstrap-whitelist.ps1`.
- Change default admin password.
- Add privacy, terms, and report rules pages.
- Test from mobile network in Russia if possible.

Exit criteria:

- Public URL works.
- Anonymous report can be submitted.
- Moderator can approve/reject reports.
- Published report appears on map/list.

### Phase 1: Public Trust Layer

Goal: make the beta feel safe and understandable.

Tasks:

- Add "Это безопасно" content block to landing/public copy.
- Add fraud warning page.
- Add "Как читать карту" FAQ.
- Add report rules in Russian.
- Add short privacy policy focused on no registration, no phone/email, approximate location, and moderation.
- Add share links for Telegram, VK, MAX, and copy link.
- Add visible disclaimer: "отметки пользователей, не официальные данные".

Exit criteria:

- New user understands safety model in the first minute.
- Public pages explain limits without sounding evasive.

### Phase 2: Better Data Quality

Goal: reduce noise and make reports more useful.

Tasks:

- Add moderator checklist.
- Add duplicate policy.
- Add confidence labels: "сам проверил", "несколько подтверждений", "со слов", "массовые жалобы".
- Add freshness buckets: now, today, yesterday, stale.
- Add operator/status filters.
- Add city/region/operator saved views.
- Add manual daily backup routine.

Exit criteria:

- Moderator can keep the map clean manually.
- Users can filter by region/operator/problem in two taps.

### Phase 3: Lightweight Public Frontend

Goal: stop relying on the heavy generic Ushahidi public UI for mass Russian traffic.

Tasks:

- Build a small static/PHP or JS frontend that consumes moderated public reports from Ushahidi.
- Keep Ushahidi for admin, forms, moderation, and storage.
- Add fast list-first view and optional map view.
- Add local-only saved places.
- Add "nearby" mode without storing exact coordinates.
- Add PWA cache for last loaded status.
- Add public JSON export.

Exit criteria:

- Main public page works well on weak mobile internet.
- User can check status even when map tiles fail.

### Phase 4: Growth And Resilience

Goal: handle audience spikes during regional outages.

Tasks:

- Move from shared hosting to Timeweb VPS or stronger managed stack.
- Add Redis/cache if needed.
- Add static mirrors for read-only status.
- Add CDN only if it does not harm access from Russia.
- Add automated offsite backups.
- Add monitoring for app, DB, cron, queue, disk, and response time.
- Add rate limits and spam controls.

Exit criteria:

- Traffic spikes do not take down reporting.
- Public status can survive backend maintenance.

### Phase 5: Community Operations

Goal: make the project maintainable by more than one person.

Tasks:

- Define moderator roles.
- Create incident response playbook.
- Create takedown/privacy request process.
- Create weekly report digest.
- Create public changelog.
- Recruit trusted regional moderators carefully.

Exit criteria:

- The project can operate without one person manually watching everything.

## Data Model Additions To Consider

Fields already present or planned:

- region;
- city/district;
- operator;
- network type;
- problem type;
- whitelist status;
- checked services;
- incident category;
- checked at;
- confidence;
- optional source;
- comment;
- approximate point.

Fields to add later:

- "problem started at";
- "problem ended at";
- "is this still happening";
- "works on Wi-Fi";
- "works on mobile";
- "works with bank/maps/taxi";
- "report source type";
- "moderation note";
- "duplicate group id";
- "public freshness score";

## Metrics

Product health:

- reports per day;
- approved reports per day;
- duplicate rate;
- rejected for personal data rate;
- median moderation time;
- reports with source/confidence;
- reports by region/operator.

Technical health:

- page load time on mobile;
- DB size;
- MySQL load;
- cron success;
- backup age;
- error rate.

Safety health:

- number of privacy edits by moderators;
- takedown requests;
- suspicious/spam submissions;
- reports with exact addresses removed.

## Timeweb Growth Plan

Start:

- Timeweb shared hosting;
- Timeweb MySQL;
- manual backups;
- manual moderation;
- no heavy public frontend.

Move to VPS when:

- reports become frequent;
- MySQL/CPU limits show up;
- cron is unreliable;
- public map is slow;
- uploads grow;
- moderation needs workers/cache.

VPS target:

- Docker Compose;
- app + MySQL + Redis on same VPS initially;
- 2 GB RAM minimum for calm beta;
- 4 GB RAM if traffic grows;
- nightly database/files backup.

Longer term:

- Ushahidi backend private/admin-facing;
- lightweight public frontend public-facing;
- static mirrors;
- stronger MySQL or managed DB;
- regional moderator workflow.

## Immediate Next Actions

1. Wait for Timeweb SSH access.
2. Build and upload shared-hosting package.
3. Verify PHP extensions and migrations.
4. Publish privacy/rules/safety pages.
5. Run bootstrap and approve first test reports.
6. Test from mobile networks.
7. Decide whether shared hosting is enough or move to VPS.
