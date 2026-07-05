# Где белые списки? submission API

`observations.php` is an optional same-origin endpoint for the lightweight public map.
`context.php` is an optional low-confidence context endpoint. It does not perform IP geolocation and only returns `WHITES_REGION_HINT` when the server operator explicitly configures it.

It accepts only `POST application/json` and writes pending observations to:

```text
public-lite/submissions/observations-pending.jsonl
```

The `submissions/` directory must stay non-public. Its `.htaccess` denies browser reads.

Accepted `kind` values:

- `problem`
- `confirm`
- `restored`
- `complaint`

The endpoint does not write raw IP addresses or user agents. It stores a short `source_hash` for rate limiting and duplicate review. Published `reports.json` must still be generated only after moderation.

Rate limiting uses three private buckets in `submissions/rate-limit.json`:

- source hash: IP + user-agent, daily HMAC;
- IP hash: IP only, daily HMAC, so rotating user-agents does not bypass throttling;
- global queue cap: protects moderation from broad spam waves.

Set `WHITES_SUBMISSION_SECRET` on production hosting so hashes cannot be reproduced from repository code.
