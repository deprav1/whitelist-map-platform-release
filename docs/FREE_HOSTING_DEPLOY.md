# Free hosting deploy

## Recommendation

Use Timeweb first if you already have a paid Russian shared-hosting tariff and it has SSH/PHP CLI/MySQL/cron. See `docs/TIMEWEB_DEPLOY.md`.

Use Fly.io for the first international public MVP app host. For the database, prefer either Aiven free MySQL or the Fly self-managed MySQL that the deploy script creates by default.

Why:

- it can deploy this repository as Docker;
- it supports persistent volumes for uploads and can run MySQL if we self-host the database;
- the app can run without Cloudflare proxying;
- a small MVP may fit into Fly's free allowance, though Fly may require a card and this is not a production SLA.

Avoid Cloudflare Pages/Workers as the primary Russian-facing host for now. Cloudflare's own support docs say Russian ISPs have throttled Cloudflare-protected traffic to about 16 KB per connection, which can make sites unusable for visitors in Russia.

Render's free tier is not a good fit for the full Ushahidi app: free services have ephemeral filesystems, persistent disks are paid, and free Postgres is not a MySQL replacement for this release.

See `docs/DATABASE_OPTIONS.md` for the database comparison.

## One-command deploy path

Install and log in to Fly:

```powershell
flyctl auth login
```

Deploy with a unique app name:

```powershell
.\scripts\deploy-fly.ps1 -AppName whites-map
```

To use an external MySQL service such as Aiven instead of creating the Fly MySQL app:

```powershell
.\scripts\deploy-fly.ps1 `
  -AppName whites-map `
  -ExternalMysqlHost '<mysql-host>' `
  -ExternalMysqlPort '<mysql-port>' `
  -ExternalMysqlDatabase '<database>' `
  -ExternalMysqlUser '<user>' `
  -ExternalMysqlPassword '<password>'
```

By default, the script creates:

- a Fly app for Ushahidi;
- a private Fly MySQL app;
- 1 GB volume for MySQL;
- 1 GB volume for uploaded files;
- production secrets for `APP_KEY`, `SITE_URL`, `MYSQL_HOST`, and `MYSQL_PASSWORD`.

After the app opens:

```powershell
$env:USH_BASE_URL='https://whites-map.fly.dev'
.\scripts\bootstrap-whitelist.ps1
```

Then log in as `admin@example.com` / `admin` and change the password immediately.

## Cost guardrails

- Use this as a public beta, not as final infrastructure.
- Keep the app machine auto-stopped while idle.
- The MySQL machine must stay available for writes; if 512 MB is unstable, scale it to 1 GB and watch billing.
- Export backups regularly before any serious public launch.

## Russian audience notes

- Do not put Cloudflare proxy in front of the primary domain.
- Keep the first version light: no external fonts, no heavy analytics, no third-party widgets.
- Publish a static mirror later for read-only emergency information.
- Keep moderation enabled and remove personal data from reports.
