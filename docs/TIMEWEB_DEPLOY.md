# Timeweb deploy

Timeweb is a good first Russian-facing host because visitors in Russia are less likely to hit foreign-hosting routing and throttling problems. The tradeoff is that the cheapest virtual hosting is not elastic infrastructure. Treat it as a public beta, not the final architecture.

## Recommended path

Start on your current Timeweb virtual hosting only if it has:

- PHP CLI access over SSH;
- MySQL database;
- Apache `.htaccess` support;
- required PHP extensions: `curl`, `json`, `mysqli`, `pdo`, `pdo_mysql`, `imap`, `gd`;
- a PHP version compatible with the bundled Ushahidi release;
- cron jobs.

If any of these are missing, use Timeweb Cloud VPS instead and run the Docker Compose version.

## Shared hosting package

Build a package locally:

```powershell
.\scripts\package-timeweb-shared.ps1 -SiteUrl 'https://your-domain.ru' -Force
```

The script downloads the Ushahidi client/API release bundles and creates:

```text
tmp/whites-timeweb-shared.zip
```

Upload the contents of `public_html/` from that zip into the Timeweb site root for the domain or subdomain.

## Database setup

In the Timeweb panel:

1. Create a MySQL database.
2. Create or copy the database user and password.
3. On the server, copy:

```bash
cp platform/.env.timeweb.example platform/.env
```

4. Edit `platform/.env`:

```text
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=<timeweb_database>
DB_USERNAME=<timeweb_user>
DB_PASSWORD=<timeweb_password>
```

If Timeweb gives a separate MySQL host, use that value instead of `localhost`.

## Migrations

Connect over SSH and run:

```bash
cd ~/path/to/site/public_html/platform
php ./bin/phinx migrate -c phinx.php
chmod -R 775 storage
```

If the `php` command points to the wrong PHP version, use the versioned binary that Timeweb provides in the control panel/docs.

## Cron

Add these cron tasks in Timeweb panel or over SSH:

```cron
*/5 * * * * cd /home/<user>/<site-root>/platform && php ./artisan datasource:outgoing >> /dev/null 2>&1
*/5 * * * * cd /home/<user>/<site-root>/platform && php ./artisan datasource:incoming >> /dev/null 2>&1
*/5 * * * * cd /home/<user>/<site-root>/platform && php ./artisan savedsearch:sync >> /dev/null 2>&1
*/5 * * * * cd /home/<user>/<site-root>/platform && php ./artisan notification:queue >> /dev/null 2>&1
*/5 * * * * cd /home/<user>/<site-root>/platform && php ./artisan webhook:send >> /dev/null 2>&1
```

Replace `/home/<user>/<site-root>` with the real path from Timeweb.

## WhiteS bootstrap

After the site opens, seed categories and the report form from your local machine:

```powershell
$env:USH_BASE_URL='https://your-domain.ru'
.\scripts\bootstrap-whitelist.ps1
```

Then log in with the upstream default admin credentials and change the password immediately. Depending on the release path, try `admin@example.com / admin` first, then `admin / admin`.

## Growth plan

### Stage 1: Timeweb shared hosting

Use it for the first beta:

- moderation enabled;
- no heavy analytics;
- small image uploads;
- manual backups;
- watch MySQL and CPU limits.

This is enough to validate whether people submit useful reports.

### Stage 2: Timeweb Cloud VPS

Move when:

- reports become frequent;
- map/list pages feel slow;
- cron is unreliable;
- database limits appear;
- you need Docker, background workers, Redis, or easier backups.

Recommended minimum for the Docker stack is 2 GB RAM. 1 GB may work only for a quiet beta and can be tight during builds, migrations, or traffic spikes.

### Stage 3: split read/write

When Russian traffic grows:

- keep Ushahidi as admin/moderation backend;
- add a lightweight read-only frontend for visitors;
- cache public report JSON;
- serve static emergency mirrors from multiple hosts;
- move MySQL to a stronger managed database or a larger VPS;
- add scheduled offsite backups.

This keeps the public site fast while preserving moderation and data ownership.
