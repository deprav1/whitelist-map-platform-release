# WhiteS lightweight public map

This is a low-bandwidth read-only public map for users. It is not a replacement for Ushahidi admin/moderation. It consumes a safe public JSON export shaped by `docs/PUBLIC_DATA_CONTRACT.md`.

Open locally:

```powershell
Start-Process .\public-lite\index.html
```

For production, publish this folder as a static page and replace `reports.json` with the moderated public export. `reports.sample.json` stays as a safe fallback file for local recovery.

Design principles:

- map-first, with the report list synchronized to markers;
- no account;
- no external fonts;
- Leaflet is vendored locally under `vendor/leaflet`;
- marker points and radius circles are approximate, not personal locations;
- active filters are reflected in the page URL for sharing.
