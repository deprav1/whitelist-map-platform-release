# Где белые списки? public map

This is a low-bandwidth read-only public map for users. It is not a replacement for Ushahidi admin/moderation. It consumes a safe public JSON export shaped by `docs/PUBLIC_DATA_CONTRACT.md`.

Open locally:

```powershell
Start-Process .\public-lite\index.html
```

For production, publish this folder as a static page and replace `reports.json` with the moderated public export. `reports.sample.json` stays as a fallback/demo file.

If PHP is available, `api/observations.php` accepts problem reports, confirmations, restorations, and complaints into a private pending queue under `submissions/`. Complaints can carry a safe reason for moderation, but the public map still reads only moderated `reports.json`; pending observations must never be exposed directly.

Static public pages:

- `faq.html`
- `rules.html`
- `privacy.html`

Moderation export is local and explicit:

```powershell
.\scripts\export-moderated-observations.ps1 -CreateTemplate
.\scripts\export-moderated-observations.ps1
```

Before packaging or deploy, run:

```powershell
.\scripts\run-public-lite-preflight.ps1 -IncludeLiveCheck
```

Design principles:

- map-first, with the report list synchronized to markers;
- no account;
- no external fonts;
- Leaflet is vendored locally under `vendor/leaflet`;
- marker points and radius circles are approximate, not personal locations;
- active filters are reflected in the page URL for sharing.
