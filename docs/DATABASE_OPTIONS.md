# Database options

WhiteS currently runs on Ushahidi Platform Release, so the database should be boring MySQL-compatible storage with support for spatial/geometry fields. Do not choose a PostgreSQL-only service unless the app is migrated away from Ushahidi.

## Best default: Aiven free MySQL

Aiven is the most interesting free database option for the MVP:

- managed MySQL;
- always-free plan;
- no credit card required;
- 1 CPU, 1 GB RAM, 1 GB disk;
- monitoring and backups included;
- not covered by the paid SLA;
- single-node and small-workload only.

Use this when you want the cheapest public MVP and are okay with a small database cap. Create the database in Aiven, then deploy the app with an external MySQL host:

```powershell
.\scripts\deploy-fly.ps1 `
  -AppName whites-map-demo `
  -ExternalMysqlHost '<aiven-host>' `
  -ExternalMysqlPort '<aiven-port>' `
  -ExternalMysqlDatabase '<aiven-database>' `
  -ExternalMysqlUser '<aiven-user>' `
  -ExternalMysqlPassword '<aiven-password>'
```

Important: Aiven strongly recommends SSL/TLS for MySQL. Test the first migration before announcing the site publicly.

## Easiest for this repo: Fly self-managed MySQL

This is what `scripts/deploy-fly.ps1` creates by default.

Pros:

- same platform and private network as the app;
- no external SSL setup;
- already scripted;
- easy to debug from one provider.

Cons:

- not a managed database;
- single machine/volume unless we add replication;
- Fly no longer has a true long-term free tier for new users;
- needs explicit backups.

Use this when we want the least integration pain.

## Cheap managed fallback: Railway MySQL

Railway is pleasant for dev UX and has a low entry price after trial, but it is not truly free long-term. Good as a fallback if Fly DB feels too manual and Aiven SSL gives trouble.

## Predictable paid baseline: DigitalOcean managed MySQL

DigitalOcean managed MySQL starts around the low paid tier and is boring in the good sense. It is too expensive for the first free MVP, but it is a clean upgrade path once the project has real users.

## Cheap server fallback: Hetzner VPS

A small Hetzner VPS can run the app and MySQL together cheaply. It is not managed and needs server maintenance, backups, firewalling, and updates. Good when monthly cost matters more than operational comfort.

## Avoid for this Ushahidi MVP

- TiDB Cloud Starter: generous free MySQL-compatible tier, but TiDB does not support MySQL SPATIAL/GIS data types, while Ushahidi uses point/geometry fields.
- PlanetScale: no free plan now, and it is overkill for this project.
- Supabase/Neon/Render Postgres: PostgreSQL only; incompatible without an app migration.
- db4free/free random MySQL hosts: fine for experiments, not for user-submitted reports.
