# Product logic

Где белые списки? is a public map for practical connectivity reports in Russia during censorship, mobile internet shutdowns, whitelist-only periods, throttling, and service failures.

## Audience need

The first audience is not technical researchers. It is people who need to know whether everyday services work right now:

- mobile internet;
- home internet;
- maps and navigation;
- banks and card payments;
- taxi apps;
- marketplaces;
- messengers;
- state services;
- foreign websites and platforms.

## MVP promise

Где белые списки? answers four questions:

1. What works here right now?
2. Which operator and network type is affected?
3. Is this a full shutdown, whitelist-only mode, throttling, partial failure, or recovery?
4. How trustworthy and fresh is the report?

## First public workflow

1. A user submits an anonymous report.
2. The report goes to moderation because `require_approval` is enabled.
3. A moderator removes personal data and merges obvious duplicates.
4. A verified report appears on the public map/list.
5. Viewers filter by region, operator, problem type, checked services, and freshness.

## Data minimization

Do not ask for:

- name;
- phone;
- exact home address;
- workplace;
- passport or account data;
- political affiliation;
- screenshots that reveal personal accounts.

The form asks for approximate location, operator, network type, symptoms, checked services, time, confidence level, and optional source.

## Publication stance

The first version should feel like a calm utility, not a manifesto. The wording should be practical and safety-first: "what works", "where", "when checked", "how confident".

## Not in MVP

- No automatic VPN recommendations.
- No sensitive identity collection.
- No exact geolocation requirement.
- No public raw author metadata.
- No Cloudflare proxy as the primary Russian-facing path.

## Next after hosting

- lightweight read-only frontend;
- offline/PWA cache;
- public JSON/CSV export;
- mirror page for emergency status;
- moderation dashboard checklist;
- backup automation.
