# Public data contract

This contract describes the safe public shape for moderated WhiteS reports. It is designed for a lightweight frontend and public exports. It must not include author metadata, private moderation notes, raw IP addresses, emails, phone numbers, or exact sensitive locations.

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
  "source": "WhiteS moderated reports",
  "disclaimer": "Пользовательские отметки, не официальные данные.",
  "reports": []
}
```

## Report shape

```json
{
  "id": "report-001",
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
- exact GPS from sensitive places;
- raw unmoderated comment;
- private moderation note;
- uploaded files before review;
- internal access tokens;
- admin URLs.

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
