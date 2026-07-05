<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'Method not allowed.');
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    json_error(415, 'Send JSON with Content-Type: application/json.');
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false || $rawBody === '') {
    json_error(400, 'Empty request body.');
}

if (strlen($rawBody) > 8192) {
    json_error(413, 'Request body is too large.');
}

$input = json_decode($rawBody, true);
if (!is_array($input)) {
    json_error(400, 'Invalid JSON.');
}

if (trim((string)($input['website'] ?? '')) !== '') {
    json_response(202, [
        'ok' => true,
        'moderation_status' => 'pending',
        'message' => 'Наблюдение принято на модерацию.'
    ]);
}

$baseDir = dirname(__DIR__);
$queueDir = $baseDir . DIRECTORY_SEPARATOR . 'submissions';
ensure_queue_dir($queueDir);

$sourceHash = client_source_hash();
$ipHash = client_ip_hash();
// Throttle before building or writing the pending record so rejected bursts never reach moderation.
enforce_rate_limit($queueDir . DIRECTORY_SEPARATOR . 'rate-limit.json', rate_limit_rules($sourceHash, $ipHash));

$record = build_observation($input, $sourceHash);
write_jsonl($queueDir . DIRECTORY_SEPARATOR . 'observations-pending.jsonl', $record);

json_response(202, [
    'ok' => true,
    'observation_id' => $record['id'],
    'moderation_status' => 'pending',
    'message' => 'Наблюдение принято на модерацию. Публично оно появится только после проверки.'
]);

function build_observation(array $input, string $sourceHash): array
{
    $allowedKinds = ['problem', 'confirm', 'restored', 'complaint'];
    $kind = clean_text((string)($input['kind'] ?? 'problem'), 24);
    if (!in_array($kind, $allowedKinds, true)) {
        json_error(422, 'Unknown observation type.');
    }

    $cityOrArea = clean_text((string)($input['city_or_area'] ?? $input['area'] ?? ''), 120);
    $operator = clean_text((string)($input['operator'] ?? ''), 80);
    $networkType = clean_text((string)($input['network_type'] ?? $input['network'] ?? ''), 80);
    $problemType = clean_text((string)($input['problem_type'] ?? $input['problem'] ?? ''), 120);
    $confidence = clean_text((string)($input['confidence'] ?? ''), 120);
    $summary = clean_text((string)($input['summary'] ?? ''), 500);
    $region = clean_text((string)($input['region'] ?? ''), 120);
    $sourceReportId = clean_id((string)($input['source_report_id'] ?? ''));
    $complaintReason = clean_id((string)($input['complaint_reason'] ?? ''));
    $safetyConfirmed = filter_var($input['safety_confirm'] ?? false, FILTER_VALIDATE_BOOLEAN);

    $services = normalize_services($input['checked_services'] ?? $input['services'] ?? []);
    $checkedAt = normalize_checked_at((string)($input['checked_at'] ?? ''));

    $required = [
        'city_or_area' => $cityOrArea,
        'operator' => $operator,
        'network_type' => $networkType,
        'problem_type' => $problemType,
        'confidence' => $confidence
    ];

    foreach ($required as $field => $value) {
        if ($value === '') {
            json_error(422, 'Missing required field: ' . $field . '.');
        }
    }

    if ($kind === 'complaint' && $sourceReportId === '') {
        json_error(422, 'Complaint must reference a public report id.');
    }

    if ($kind === 'complaint') {
        $allowedComplaintReasons = ['personal_data', 'exact_location', 'dangerous', 'wrong', 'duplicate', 'outdated', 'other'];
        if (!in_array($complaintReason, $allowedComplaintReasons, true)) {
            json_error(422, 'Unknown complaint reason.');
        }
    } else {
        $complaintReason = '';
    }

    if (!$safetyConfirmed) {
        json_error(422, 'Перед отправкой подтвердите, что сообщение не содержит личных данных, точного адреса, GPS, приватных ссылок и опасных инструкций.');
    }

    $privateScan = implode(' ', array_merge([
        $region,
        $cityOrArea,
        $operator,
        $networkType,
        $problemType,
        $confidence,
        $summary
    ], $services));

    $riskFlags = risky_content_flags($privateScan);
    $priorityReasons = ['personal_data', 'exact_location', 'dangerous'];
    $priorityComplaint = $kind === 'complaint' && in_array($complaintReason, $priorityReasons, true);

    $now = gmdate('c');
    $id = 'obs_' . gmdate('Ymd_His') . '_' . random_suffix();

    $record = [
        'schema_version' => 1,
        'id' => $id,
        'kind' => $kind,
        'moderation_status' => 'pending',
        'created_at' => $now,
        'checked_at' => $checkedAt,
        'source_hash' => substr($sourceHash, 0, 20),
        'risk_level' => ($riskFlags || $priorityComplaint) ? 'high' : 'normal',
        'risk_flags' => $riskFlags,
        'review_priority' => ($riskFlags || $priorityComplaint) ? 'first' : 'normal',
        'source_report_id' => $sourceReportId,
        'dedupe_key' => dedupe_key($region, $cityOrArea, $operator, $networkType, $problemType, $checkedAt),
        'region' => $region,
        'city_or_area' => $cityOrArea,
        'operator' => $operator,
        'network_type' => $networkType,
        'problem_type' => $problemType,
        'checked_services' => $services,
        'confidence' => $confidence,
        'summary' => $summary
    ];

    if ($kind === 'complaint') {
        $record['complaint_reason'] = $complaintReason;
    }

    return $record;
}

function ensure_queue_dir(string $queueDir): void
{
    if (!is_dir($queueDir) && !mkdir($queueDir, 0700, true)) {
        json_error(503, 'Submission queue is not writable.');
    }

    if (!is_writable($queueDir)) {
        json_error(503, 'Submission queue is not writable.');
    }

    $denyFile = $queueDir . DIRECTORY_SEPARATOR . '.htaccess';
    if (!is_file($denyFile)) {
        @file_put_contents($denyFile, "Require all denied\nDeny from all\nOptions -Indexes\n");
    }
}

function clean_text(string $value, int $maxLength): string
{
    $value = preg_replace('/\s+/u', ' ', trim($value));
    if ($value === null) {
        $value = '';
    }

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength, 'UTF-8');
    }

    return substr($value, 0, $maxLength);
}

function clean_id(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }

    $clean = preg_replace('/[^A-Za-z0-9_.:-]/', '', substr($value, 0, 80));
    return $clean === null ? '' : $clean;
}

function normalize_services($value): array
{
    if (is_string($value)) {
        $value = preg_split('/[,;]+/u', $value);
    }

    if (!is_array($value)) {
        return [];
    }

    $items = [];
    foreach ($value as $item) {
        $clean = clean_text((string)$item, 80);
        if ($clean !== '') {
            $items[] = $clean;
        }
    }

    return array_values(array_slice(array_unique($items), 0, 12));
}

function normalize_checked_at(string $value): string
{
    $timestamp = strtotime($value);
    if ($timestamp === false) {
        $timestamp = time();
    }

    return gmdate('c', $timestamp);
}

function contains_private_data(string $value): bool
{
    return count(risky_content_flags($value)) > 0;
}

function risky_content_flags(string $value): array
{
    $flags = [];

    if (preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/iu', $value)) {
        $flags[] = 'email';
    }

    if (preg_match('/\+?\d[\d\s\-\(\)]{7,}\d/u', $value)) {
        $flags[] = 'phone';
    }

    if (preg_match('/\b(?:\d{1,3}\.){3}\d{1,3}\b/u', $value)) {
        $flags[] = 'ip_address';
    }

    if (preg_match('/\b\d{1,2}[\.,]\d{4,}\s*[,; ]\s*\d{1,3}[\.,]\d{4,}\b/u', $value)) {
        $flags[] = 'precise_coordinates';
    }

    if (preg_match('/https?:\/\/|www\.|t\.me\/|vk\.com\/|instagram\.com\/|facebook\.com\//iu', $value)) {
        $flags[] = 'url';
    }

    if (preg_match('/\b(ул\.?|улица|проспект|пр-т|дом|д\.|квартира|кв\.|подъезд|этаж)\b/iu', $value)) {
        $flags[] = 'exact_address_marker';
    }

    if (preg_match('/\b(vpn|proxy|прокси|wireguard|openvpn|outline|ключ|конфиг|config|wg:\/\/|ss:\/\/|vless:\/\/|trojan:\/\/)\b/iu', $value)) {
        $flags[] = 'vpn_proxy_or_key';
    }

    if (preg_match('/\b(user-agent|mozilla\/5\.0|curl\/|okhttp|python-requests)\b/iu', $value)) {
        $flags[] = 'user_agent_like';
    }

    return array_values(array_unique($flags));
}

function dedupe_key(string $region, string $cityOrArea, string $operator, string $networkType, string $problemType, string $checkedAt): string
{
    $timestamp = strtotime($checkedAt);
    if ($timestamp === false) {
        $timestamp = time();
    }
    $bucket = gmdate('YmdH', (int)(floor($timestamp / 21600) * 21600));

    return hash('sha256', normalize_key_text(implode('|', [
        $region,
        $cityOrArea,
        $operator,
        $networkType,
        $problemType,
        $bucket
    ])));
}

function normalize_key_text(string $value): string
{
    if (function_exists('mb_strtolower')) {
        $value = mb_strtolower($value, 'UTF-8');
    } else {
        $value = strtolower($value);
    }

    $value = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $value);
    return trim((string)($value ?? ''));
}

function random_suffix(): string
{
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes(4));
    }

    return dechex(mt_rand(0, 0xffffffff));
}

function client_source_hash(): string
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? 'unknown');
    // Daily HMAC: useful for moderation dedupe, but not reusable as a long-term identifier.
    return hash_hmac('sha256', $ip . '|' . $ua . '|' . gmdate('Y-m-d'), submission_secret());
}

function client_ip_hash(): string
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    // Separate IP-only bucket prevents bypass by rotating user-agent strings.
    return hash_hmac('sha256', $ip . '|' . gmdate('Y-m-d'), submission_secret());
}

function submission_secret(): string
{
    $secret = getenv('WHITES_SUBMISSION_SECRET');
    if (!$secret) {
        $secret = hash('sha256', __FILE__ . '|' . php_uname('n'));
    }

    return $secret;
}

function rate_limit_rules(string $sourceHash, string $ipHash): array
{
    // Layered buckets: strict per source, wider per IP, and a queue-wide emergency cap.
    return [
        [
            'key' => 'source:' . $sourceHash,
            'recent_limit' => 4,
            'daily_limit' => 20
        ],
        [
            'key' => 'ip:' . $ipHash,
            'recent_limit' => 8,
            'daily_limit' => 40
        ],
        [
            'key' => 'global',
            'recent_limit' => 120,
            'daily_limit' => 600
        ]
    ];
}

function enforce_rate_limit(string $path, array $rules): void
{
    $now = time();
    $lock = fopen($path, 'c+');
    if ($lock === false) {
        json_error(503, 'Rate limit storage is not writable.');
    }

    if (!flock($lock, LOCK_EX)) {
        fclose($lock);
        json_error(503, 'Rate limit storage is locked.');
    }

    $raw = stream_get_contents($lock);
    $data = $raw ? json_decode($raw, true) : [];
    if (!is_array($data)) {
        $data = [];
    }

    foreach ($data as $hash => $events) {
        if (!is_array($events)) {
            unset($data[$hash]);
            continue;
        }
        // Keep a short audit window for counters only; raw request metadata is never persisted here.
        $data[$hash] = array_values(array_filter($events, function ($timestamp) use ($now) {
            return is_int($timestamp) && $timestamp >= $now - 604800;
        }));
        if (!$data[$hash]) {
            unset($data[$hash]);
        }
    }

    foreach ($rules as $rule) {
        $key = (string)($rule['key'] ?? '');
        if ($key === '') {
            continue;
        }

        $events = $data[$key] ?? [];
        if (!is_array($events)) {
            $events = [];
        }

        $recent = array_filter($events, function ($timestamp) use ($now) {
            return is_int($timestamp) && $timestamp >= $now - 900;
        });
        $daily = array_filter($events, function ($timestamp) use ($now) {
            return is_int($timestamp) && $timestamp >= $now - 86400;
        });

        $recentLimit = (int)($rule['recent_limit'] ?? 0);
        $dailyLimit = (int)($rule['daily_limit'] ?? 0);
        if (($recentLimit > 0 && count($recent) >= $recentLimit) || ($dailyLimit > 0 && count($daily) >= $dailyLimit)) {
            flock($lock, LOCK_UN);
            fclose($lock);
            json_error(429, 'Слишком много отправок. Попробуйте позже.');
        }
    }

    foreach ($rules as $rule) {
        $key = (string)($rule['key'] ?? '');
        if ($key === '') {
            continue;
        }

        $events = $data[$key] ?? [];
        if (!is_array($events)) {
            $events = [];
        }
        $events[] = $now;
        $data[$key] = array_values($events);
    }

    rewind($lock);
    ftruncate($lock, 0);
    fwrite($lock, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($lock);
    flock($lock, LOCK_UN);
    fclose($lock);
}

function write_jsonl(string $path, array $record): void
{
    $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line === false) {
        json_error(500, 'Could not encode observation.');
    }

    $file = fopen($path, 'ab');
    if ($file === false) {
        json_error(503, 'Submission queue is not writable.');
    }

    if (!flock($file, LOCK_EX)) {
        fclose($file);
        json_error(503, 'Submission queue is locked.');
    }

    fwrite($file, $line . PHP_EOL);
    fflush($file);
    flock($file, LOCK_UN);
    fclose($file);
}

function json_error(int $status, string $message): void
{
    json_response($status, [
        'ok' => false,
        'message' => $message
    ]);
}

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
