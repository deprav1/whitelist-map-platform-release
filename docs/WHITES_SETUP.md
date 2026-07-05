# Где белые списки? setup

This repository is an Ushahidi Platform Release fork configured for a crowdsourced whitelist map.

## Local run

1. Install Docker Desktop and reopen PowerShell so `docker` is available in PATH.
2. Copy `.env.example` to `.env`.
3. Change the database passwords in `.env`.
4. Start the platform:

```powershell
docker compose up -d --build
```

If your Docker install only has the old Compose command, use:

```powershell
docker-compose up -d --build
```

The app should open at `http://localhost:8080` by default.

## First admin login

The upstream release seeds the default admin account as `admin@example.com` / `admin`.
Change this password before exposing the site publicly.

## Bootstrap the whitelist map

After the containers are running and the app responds, create the Где белые списки? categories and report form:

```powershell
.\scripts\bootstrap-whitelist.ps1
```

To validate the payload without calling the API:

```powershell
.\scripts\bootstrap-whitelist.ps1 -DryRun
```

The bootstrap creates:

- moderation enabled via `require_approval: true`;
- public report creation via `everyone_can_create: true`;
- fields for region, operator, network type, problem type, checked services, whitelist status, verification time, confidence, map point, comment, and optional source URL;
- starter categories for shutdown, whitelist-only, partial connectivity, restored, and needs verification states.

## Publish the MVP

See `docs/FREE_HOSTING_DEPLOY.md` for the Fly.io deployment path.

## Operational notes

- `APP_PORT` controls the local host port; default is `8080`.
- `SITE_URL` must match the public URL when deploying outside localhost.
- MySQL, Redis, and uploaded files use named Docker volumes, so ordinary container restarts keep data.
- `do_backup.sh` is still available for backups once Docker is installed.
