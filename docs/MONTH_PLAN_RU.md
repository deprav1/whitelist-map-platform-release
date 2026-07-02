# 30-day development plan

This is the maximum useful one-month plan for WhiteS before and immediately after the first public launch. It assumes one main builder, occasional help from testers/moderators, and Timeweb as the first target host.

## Month Goal

By the end of 30 days WhiteS should be a public beta that Russian users can open from a normal phone, understand in under a minute, and use without registration to check or report internet/connectivity problems safely.

The ideal month-end state:

- public URL is online on Timeweb or Timeweb VPS;
- anonymous report flow works;
- moderation flow works;
- first 20-50 test reports are submitted and cleaned;
- privacy, rules, safety, and fraud-warning pages are published;
- backups are documented and tested;
- there is a lightweight public-read strategy ready or partially built;
- the project has a clear next migration path if shared hosting becomes tight.

## Priority System

### P0: Must Ship

- Timeweb deploy path tested.
- Database migrations complete.
- Bootstrap creates WhiteS form and categories.
- Default admin password changed.
- Anonymous reporting works.
- Moderation is enabled.
- Privacy/rules/safety pages exist.
- Manual backup and restore procedure exists.
- No personal data is required in the report form.

### P1: Should Ship

- User-facing safety block: no registration, no app download, no phone/email.
- Report rules page.
- "How to read the map" FAQ.
- Moderator checklist.
- Duplicate/spam policy.
- Share links: Telegram, VK, MAX, copy link.
- Operator/problem/freshness filter guidelines.
- Low-bandwidth QA checklist.

### P2: Maximum Track

- Lightweight public frontend prototype.
- Public JSON export of moderated reports.
- Local-only saved places.
- Region/operator landing pages.
- PWA/offline cache prototype.
- Static emergency status mirror.
- Telegram channel/community workflow.

## User Scenarios To Optimize

### Scenario A: "Internet is broken here"

The user opens WhiteS and wants to know whether the problem is local, operator-specific, or widespread.

Requirements:

- current region status visible quickly;
- filters by region, operator, network type, problem type;
- freshness shown clearly;
- no login;
- no exact GPS requirement.

### Scenario B: "I want to report safely"

The user wants to help others without exposing themselves.

Requirements:

- short anonymous form;
- warning against personal data before comment/upload;
- approximate location accepted;
- confirmation that report goes to moderation;
- no phone/email/name.

### Scenario C: "I moderate reports"

Moderator needs to approve useful reports and remove risky content.

Requirements:

- checklist for personal data, panic, duplicates, spam, exact addresses;
- clear statuses;
- confidence/freshness rules;
- backup before risky admin changes.

### Scenario D: "I need to check this often"

Returning user wants saved places/operators.

Requirements:

- local-only saved views later;
- no account;
- share link to same filtered page.

## Week 1: Deployment Readiness And Safety Foundation

Goal: make the project launchable and trustworthy before public traffic.

### Day 1

- Confirm Timeweb tariff details: PHP version, SSH, PHP CLI, MySQL, cron, `.htaccess`.
- Prepare exact deploy checklist for the real Timeweb path.
- Decide launch domain/subdomain.
- Decide whether launch starts on shared hosting or VPS.

Deliverables:

- filled Timeweb checklist;
- launch domain decision;
- go/no-go for shared hosting.

### Day 2

- Run `scripts/package-timeweb-shared.ps1` locally once access decisions are known.
- Fix package issues if release tarballs, paths, or `.htaccess` fail.
- Prepare upload instructions.

Deliverables:

- `tmp/whites-timeweb-shared.zip`;
- verified package contents.

### Day 3

- Create Timeweb MySQL database.
- Upload package via SSH/SFTP.
- Create `platform/.env`.
- Run migrations.
- Fix PHP extension/version issues.

Deliverables:

- site opens;
- DB tables exist;
- migrations completed.

### Day 4

- Configure cron.
- Run bootstrap script.
- Change admin password.
- Submit first test report.
- Approve/reject test report.

Deliverables:

- WhiteS survey exists;
- categories exist;
- report flow tested;
- moderation tested.

### Day 5

- Publish privacy policy draft.
- Publish report rules.
- Publish "How to read the data" FAQ.
- Publish "WhiteS does not ask for payment, downloads, phone, email, or passwords" safety/fraud warning.

Deliverables:

- trust/safety pages visible from footer or menu.

### Day 6

- Mobile QA:
  - Android Chrome;
  - iPhone Safari if available;
  - slow connection simulation where possible;
  - mobile network from Russia if possible.
- Verify map/list usability.
- Check form completion time.

Deliverables:

- QA notes;
- list of launch blockers.

### Day 7

- Fix launch blockers.
- Document first backup procedure.
- Export DB backup manually.
- Archive uploaded files/storage manually.

Deliverables:

- backup file exists;
- restore notes started;
- beta launch readiness decision.

Week 1 success:

- Site is online privately or semi-publicly.
- At least one test report can be submitted and moderated.
- User-facing safety pages exist.

## Week 2: Public Beta And Moderation Operations

Goal: open to a small audience and learn whether data is useful.

### Day 8

- Soft launch to 5-10 trusted testers.
- Ask testers to submit reports from different operators/regions.
- Collect confusion points.

Deliverables:

- first tester feedback;
- first real-ish reports.

### Day 9

- Write moderator checklist:
  - personal data;
  - exact addresses;
  - names/phones;
  - panic language;
  - duplicates;
  - unverifiable claims;
  - spam.
- Create rejection reasons.

Deliverables:

- `docs/MODERATION_RU.md`.

### Day 10

- Adjust form labels/instructions from tester feedback.
- Reduce friction where users hesitate.
- Add stronger warning before comments if people enter personal data.

Deliverables:

- improved survey config;
- updated bootstrap/update notes.

### Day 11

- Add public communication text:
  - short project description;
  - "not official data";
  - "freshness matters";
  - "how to help".
- Prepare Telegram/VK/MAX announcement drafts.

Deliverables:

- launch announcement text;
- share snippets.

### Day 12

- Add basic operational logs:
  - reports received;
  - approved;
  - rejected;
  - duplicate;
  - personal data removed.
- This can start as a manual spreadsheet or markdown log.

Deliverables:

- simple operations tracker.

### Day 13

- Second tester wave: 20-30 people if available.
- Ask for specific scenarios:
  - mobile internet down;
  - only some services work;
  - restored access;
  - map page on weak connection.

Deliverables:

- data quality notes;
- list of top 5 UX problems.

### Day 14

- Weekly review.
- Decide:
  - stay on shared hosting;
  - prepare VPS migration;
  - reduce media uploads;
  - prioritize lightweight frontend.

Deliverables:

- Week 2 review;
- Week 3 scope lock.

Week 2 success:

- 20+ reports tested.
- Moderator workflow works.
- No serious privacy issues remain unhandled.

## Week 3: Lightweight Public Experience

Goal: reduce dependency on the heavy Ushahidi public UI and prepare for traffic.

### Day 15

- Design lightweight public frontend requirements:
  - list-first;
  - optional map;
  - filters;
  - freshness labels;
  - share links;
  - no login;
  - no external fonts.

Deliverables:

- frontend spec.

### Day 16

- Investigate Ushahidi public API endpoints for moderated report export.
- Decide JSON shape for public frontend.
- Define which fields are safe to expose.

Deliverables:

- `docs/PUBLIC_DATA_CONTRACT.md`.

### Day 17

- Build prototype static page:
  - status cards;
  - filters;
  - sample/mock data;
  - mobile-first layout.

Deliverables:

- local public frontend prototype.

### Day 18

- Add real-data adapter or export script if API access is straightforward.
- If not, create manual export as a temporary bridge.

Deliverables:

- frontend reads real or exported data.

### Day 19

- Add local-only saved places prototype:
  - region/operator saved in local storage;
  - no server account;
  - reset button.

Deliverables:

- saved views prototype.

### Day 20

- Add low-bandwidth mode:
  - list works without map tiles;
  - minimal CSS;
  - no large images;
  - no third-party widgets.

Deliverables:

- low-bandwidth frontend pass.

### Day 21

- Review frontend with testers.
- Decide whether to publish it as beta public homepage or keep it as next month work.

Deliverables:

- frontend go/no-go;
- Week 4 deployment/growth plan.

Week 3 success:

- There is a credible path to a fast public interface.
- Public data exposure rules are clear.

## Week 4: Growth, Resilience, And Public Launch Polish

Goal: make the project stable enough for broader sharing.

### Day 22

- Add backup automation plan:
  - DB dump frequency;
  - files backup;
  - storage location;
  - restore drill.

Deliverables:

- `docs/BACKUP_RESTORE_RU.md`.

### Day 23

- Run restore drill locally or on staging if possible.
- Confirm backup is not just theoretical.

Deliverables:

- restore drill notes.

### Day 24

- Add simple monitoring checklist:
  - site opens;
  - report form opens;
  - cron ran;
  - DB size;
  - disk size;
  - latest backup age.

Deliverables:

- `docs/OPERATIONS_CHECKLIST_RU.md`.

### Day 25

- Prepare SEO/share landing structure:
  - `/moscow`;
  - `/spb`;
  - `/operators/mts`;
  - `/operators/megafon`;
  - `/status/whitelist-only`;
  - region pages later.

Deliverables:

- content plan for city/operator pages.

### Day 26

- Publish or schedule communication channels:
  - Telegram channel;
  - MAX/VK if needed for Russian audience;
  - contact method for reports about errors.

Deliverables:

- public communication channels ready.

### Day 27

- Anti-spam pass:
  - form friction without login;
  - rate-limit options;
  - moderation queue rules;
  - blocked words/patterns if available;
  - manual emergency switch.

Deliverables:

- anti-spam playbook.

### Day 28

- Load/risk review:
  - shared-hosting limits;
  - DB growth estimate;
  - image uploads;
  - cron reliability;
  - Timeweb VPS migration trigger.

Deliverables:

- migration trigger thresholds.

### Day 29

- Public launch polish:
  - final copy review;
  - footer links;
  - privacy/rules links;
  - safety warning visible;
  - first reports cleaned;
  - screenshots for announcements.

Deliverables:

- release candidate.

### Day 30

- Public beta launch or controlled wider beta.
- Watch moderation queue.
- Record launch metrics.
- Write next-month plan based on real usage.

Deliverables:

- launch notes;
- first metrics;
- next-month priorities.

Week 4 success:

- WhiteS is ready for a wider beta.
- There is a working backup/ops routine.
- Growth triggers are clear.

## Fallback Plan If SSH Access Is Delayed

If Timeweb access is unavailable for the whole month, still complete:

- Timeweb package script dry checks.
- Legal/safety pages.
- Moderator checklist.
- Public data contract.
- Lightweight frontend with mock data.
- Backup/operations docs.
- Announcement drafts.
- Test report dataset.
- Deployment rehearsal checklist.

This keeps the project moving so SSH access becomes execution, not planning.

## Maximum Stretch Goals

Do these only if P0 and P1 are stable:

- Publish lightweight frontend as the default public page.
- Add public JSON export.
- Add local-only saved places.
- Add emergency static mirror page.
- Add first 10 region/operator landing pages.
- Add Telegram bot only for notifications, not sensitive report collection.
- Add simple report confidence score.
- Add duplicate grouping in moderation notes.

## Definition Of Done For The Month

The month is successful if:

- a user can understand WhiteS without explanation;
- a user can submit a safe anonymous report;
- a moderator can clean and publish reports;
- published data does not expose personal information;
- backups exist and have been tested at least once;
- the project has a clear path from Timeweb shared hosting to VPS;
- we know, from real users or testers, which part to improve next.

## Red Lines

Do not ship:

- required phone/email/name registration;
- exact GPS as mandatory;
- public raw comments without moderation;
- public author metadata;
- heavy third-party analytics;
- Cloudflare proxy as the main Russian-facing path without access testing;
- instructions that turn the product from status reporting into risky evasion guidance.

## Weekly Review Questions

- Did users understand what the service does?
- Did users feel safe submitting?
- Were reports useful after moderation?
- Did any report expose personal data?
- Did shared hosting show CPU/MySQL limits?
- What was the slowest page?
- What confused testers most?
- What should be removed before adding more features?
