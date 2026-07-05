# Public data contract

This contract describes the safe public shape for moderated Где белые списки? reports. It is designed for a lightweight frontend and public exports. It must not include author metadata, private moderation notes, raw IP addresses, emails, phone numbers, or exact sensitive locations.

## File

Default public export path:

```text
reports.json
```

Accepted fallback paths:

```text
data/public-reports.json
reports.sample.json
```

## Top-level shape

```json
{
  "updated_at": "2026-07-02T12:00:00+03:00",
  "source": "Где белые списки? moderated reports",
  "disclaimer": "Пользовательские отметки, не официальные данные.",
  "export_manifest": {
    "schema_version": "1.1",
    "record_count": 0,
    "generated_at": "2026-07-02T12:00:00+03:00",
    "generated_from_moderation_revision": "moderation-decisions:example"
  },
  "reports": []
}
```

`export_manifest` is public metadata about the export, not a moderation log. It must not contain reviewer names, internal notes, source hashes, IPs, raw pending text, or admin URLs.

Safe manifest fields:

- `schema_version`: public data contract version.
- `record_count`: number of records in `reports`; validators must reject mismatches.
- `generated_at`: time when this public export was generated.
- `generated_from_moderation_revision`: opaque public-safe revision label, for example a decision file name or release id.

## Report shape

```json
{
  "id": "demo-001",
  "region": "Москва",
  "city_or_area": "ЮАО",
  "operator": "МТС",
  "network_type": "Мобильный интернет",
  "problem_type": "Работает только белый список",
  "incident_category": "whitelist-only",
  "checked_services": ["Карты / навигация", "Такси", "Банки / оплата"],
  "checked_at": "2026-07-02T18:30:00+03:00",
  "confidence": "Проверил сам",
  "confirmation_count": 3,
  "restoration_count": 0,
  "last_restored_at": null,
  "status": "published",
  "summary": "Карты и такси не открывались, банковское приложение работало.",
  "approx_location": {
    "lat": 55.62,
    "lon": 37.61,
    "precision": "district"
  }
}
```

## Safe fields

- `id`: public random id, not database id if that exposes internals.
- `region`: public.
- `city_or_area`: public, approximate.
- `operator`: public.
- `network_type`: public.
- `problem_type`: public.
- `incident_category`: public category slug.
- `checked_services`: public list.
- `checked_at`: public time of check.
- `confidence`: public confidence label.
- `confirmation_count`: optional public count of independent confirmations.
- `restoration_count`: optional public count of independent restoration signals.
- `last_restored_at`: optional public time of the latest moderated restoration signal.
- `status`: public records must be `published`; pending/rejected/private/merged records must not be exposed.
- `freshness`: optional cached bucket; frontend recalculates freshness from `checked_at`.
- `summary`: moderated text only.
- `approx_location`: optional approximate location.

## Fields not allowed in public export

- author id;
- username;
- email;
- phone;
- IP address;
- user-agent;
- source hash;
- risk flags, risk level, review priority;
- exact GPS from sensitive places;
- raw unmoderated comment;
- private moderation note;
- uploaded files before review;
- internal access tokens;
- admin URLs.

Before a public export is deployed, run both structural validation and safety audit:

```powershell
.\scripts\validate-public-data.ps1 -Path public-lite\reports.json
.\scripts\audit-public-data-safety.ps1 -Path public-lite\reports.json
```

## Freshness buckets

- `now`: checked within 3 hours.
- `today`: checked within 24 hours.
- `recent`: checked within 7 days.
- `stale`: older than 7 days.

## Category slugs

- `internet-shutdown`;
- `whitelist-only`;
- `partial-connectivity`;
- `restored`;
- `needs-verification`.

## Frontend behavior

The public frontend should:

- default to map-first on desktop, with instant map/list tabs on mobile;
- show freshness and confidence near every report;
- work if map visualization is unavailable;
- filter by region, operator, network type, problem type, and service;
- avoid external fonts and heavy third-party scripts;
- store only the last safe public export in browser local storage for low-connectivity fallback.
