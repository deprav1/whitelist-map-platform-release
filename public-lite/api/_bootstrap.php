<?php
declare(strict_types=1);

const WHITES_MAX_BODY_BYTES = 32768;
const WHITES_SCHEMA_VERSION = 1;

function whites_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function whites_fail(string $code, string $message, int $status = 400, array $extra = []): void
{
    whites_json(array_merge([
        'ok' => false,
        'error' => $code,
        'message' => $message,
    ], $extra), $status);
}

function whites_require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        header('Allow: ' . $method);
        whites_fail('method_not_allowed', 'Этот endpoint принимает только ' . $method . '.', 405);
    }
}

function whites_data_dir(): string
{
    $envDir = getenv('WHITES_DATA_DIR');
    if (is_string($envDir) && trim($envDir) !== '') {
        return rtrim($envDir, "/\\");
    }

    $current = __DIR__;
    while ($current !== dirname($current)) {
        if (basename($current) === 'public_html') {
            return dirname($current) . '/whites-data';
        }
        $current = dirname($current);
    }

    return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'whites-data-local';
}

function whites_db_path(): string
{
    return whites_data_dir() . DIRECTORY_SEPARATOR . 'whites.sqlite';
}

function whites_ensure_data_dir(): void
{
    $dir = whites_data_dir();
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Cannot create data directory.');
    }

    @chmod($dir, 0700);
    if (!is_writable($dir)) {
        throw new RuntimeException('Data directory is not writable.');
    }
}

function whites_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    whites_ensure_data_dir();
    $pdo = new PDO('sqlite:' . whites_db_path(), null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    whites_init_schema($pdo);
    return $pdo;
}

function whites_init_schema(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending_review',
            region TEXT NOT NULL DEFAULT '',
            city_or_area TEXT NOT NULL DEFAULT '',
            operator TEXT NOT NULL DEFAULT '',
            network_type TEXT NOT NULL DEFAULT '',
            problem_type TEXT NOT NULL DEFAULT '',
            incident_category TEXT NOT NULL DEFAULT 'needs-verification',
            checked_services_json TEXT NOT NULL DEFAULT '[]',
            checked_at TEXT NOT NULL DEFAULT '',
            confidence TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL DEFAULT '',
            safety_flags_json TEXT NOT NULL DEFAULT '[]',
            payload_json TEXT NOT NULL
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS complaints (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            report_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            comment TEXT NOT NULL DEFAULT '',
            safety_flags_json TEXT NOT NULL DEFAULT '[]',
            payload_json TEXT NOT NULL
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS public_reports (
            id TEXT PRIMARY KEY,
            updated_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'published',
            region TEXT NOT NULL,
            city_or_area TEXT NOT NULL,
            operator TEXT NOT NULL,
            network_type TEXT NOT NULL,
            problem_type TEXT NOT NULL,
            incident_category TEXT NOT NULL,
            checked_services_json TEXT NOT NULL DEFAULT '[]',
            checked_at TEXT NOT NULL,
            confidence TEXT NOT NULL,
            confirmation_count INTEGER NOT NULL DEFAULT 1,
            summary TEXT NOT NULL,
            approx_lat REAL,
            approx_lon REAL,
            approx_precision TEXT
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS moderation_events (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT ''
        )
    ");

    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_submissions_status_created ON submissions(status, created_at)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_complaints_status_created ON complaints(status, created_at)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_complaints_report_id ON complaints(report_id)');
    $pdo->exec('PRAGMA user_version = ' . WHITES_SCHEMA_VERSION);
}

function whites_request_data(): array
{
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > WHITES_MAX_BODY_BYTES) {
        whites_fail('payload_too_large', 'Слишком большой запрос.', 413);
    }

    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (str_contains($contentType, 'application/json')) {
        $raw = file_get_contents('php://input') ?: '';
        if (trim($raw) === '') {
            return [];
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            whites_fail('bad_json', 'Не удалось прочитать JSON.', 400);
        }
        return $data;
    }

    return $_POST;
}

function whites_clean_text(mixed $value, int $maxLength): string
{
    if (!is_scalar($value)) {
        return '';
    }

    $text = trim((string)$value);
    $text = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $text) ?? '';
    $text = preg_replace('/\s{2,}/u', ' ', $text) ?? '';
    return mb_substr($text, 0, $maxLength, 'UTF-8');
}

function whites_text(array $data, string $key, int $maxLength): string
{
    return whites_clean_text($data[$key] ?? '', $maxLength);
}

function whites_list(array $data, string $key, int $maxItems = 12): array
{
    $value = $data[$key] ?? [];
    $items = [];

    if (is_string($value)) {
        $items = preg_split('/[,;\n]+/u', $value) ?: [];
    } elseif (is_array($value)) {
        $items = $value;
    }

    $cleaned = [];
    foreach ($items as $item) {
        $text = whites_clean_text($item, 60);
        if ($text !== '') {
            $cleaned[$text] = true;
        }
    }

    return array_slice(array_keys($cleaned), 0, $maxItems);
}

function whites_now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function whites_id(string $prefix): string
{
    return $prefix . bin2hex(random_bytes(8));
}

function whites_incident_category(string $problem): string
{
    $lower = mb_strtolower($problem, 'UTF-8');
    if (str_contains($lower, 'восстанов')) {
        return 'restored';
    }
    if (str_contains($lower, 'бел') || str_contains($lower, 'whitelist')) {
        return 'whitelist-only';
    }
    if (str_contains($lower, 'полностью') || str_contains($lower, 'отключ')) {
        return 'internet-shutdown';
    }
    if (str_contains($lower, 'част')) {
        return 'partial-connectivity';
    }
    return 'needs-verification';
}

function whites_safety_flags(array $texts): array
{
    $joined = mb_strtolower(implode("\n", $texts), 'UTF-8');
    $flags = [];

    $patterns = [
        'possible_email' => '/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/iu',
        'possible_phone' => '/(?:\+?\d[\s().-]*){9,}/u',
        'possible_url' => '#https?://|www\.#iu',
        'possible_social_handle' => '/(^|\s)@[a-z0-9_]{4,}/iu',
        'possible_exact_address' => '/\b(ул\.?|улица|дом|д\.|кв\.?|подъезд|этаж)\b/iu',
    ];

    foreach ($patterns as $flag => $pattern) {
        if (preg_match($pattern, $joined) === 1) {
            $flags[] = $flag;
        }
    }

    return $flags;
}

function whites_bool(array $data, string $key): bool
{
    $value = $data[$key] ?? false;
    return $value === true || $value === 'true' || $value === '1' || $value === 1;
}
