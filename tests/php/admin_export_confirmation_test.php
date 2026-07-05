<?php
declare(strict_types=1);

function fail_test(string $message): never
{
    fwrite(STDERR, "FAIL: {$message}\n");
    exit(1);
}

function assert_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fail_test($message . ' Expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

$tmpRoot = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'whites-admin-export-' . bin2hex(random_bytes(4));
$dataDir = $tmpRoot . DIRECTORY_SEPARATOR . 'data';
$reportsPath = $tmpRoot . DIRECTORY_SEPARATOR . 'reports.json';

if (!mkdir($dataDir, 0700, true) && !is_dir($dataDir)) {
    fail_test('Cannot create temp data directory.');
}

$initialExport = [
    'updated_at' => '2026-07-06T00:00:00+03:00',
    'source' => 'WhiteS moderated public reports',
    'disclaimer' => 'Unit test export.',
    'reports' => [
        [
            'id' => 'legacy-json-only',
            'status' => 'published',
            'region' => 'Test region',
            'city_or_area' => 'Test city',
            'operator' => 'Test operator',
            'network_type' => 'Mobile',
            'problem_type' => 'Partial',
            'incident_category' => 'partial-connectivity',
            'checked_services' => ['Telegram'],
            'checked_at' => '2026-07-06T10:00:00+03:00',
            'confidence' => 'Checked',
            'confirmation_count' => 7,
            'freshness' => 'today',
            'summary' => 'Existing JSON-only report.',
        ],
    ],
];

file_put_contents($reportsPath, json_encode($initialExport, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n");

putenv('WHITES_DATA_DIR=' . $dataDir);
putenv('WHITES_REPORTS_PATH=' . $reportsPath);
putenv('WHITES_ADMIN_TOKEN=unit-test-token');

$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/admin/';

ob_start();
require __DIR__ . '/../../public-lite/admin/index.php';
ob_end_clean();

$pdo = whites_db();
$pdo->exec("
    INSERT INTO public_reports (
        id, updated_at, status, region, city_or_area, operator, network_type,
        problem_type, incident_category, checked_services_json, checked_at,
        confidence, confirmation_count, summary, approx_lat, approx_lon, approx_precision
    ) VALUES (
        'report-unit', '2026-07-06T10:00:00Z', 'published', 'Unit region', 'Unit city', 'Unit operator',
        'Mobile', 'Partial outage', 'partial-connectivity', '[\"Telegram\"]',
        '2026-07-06T10:00:00+03:00', 'Checked', 2, 'Safe summary.', NULL, NULL, NULL
    )
");

$insertConfirmation = $pdo->prepare("
    INSERT OR IGNORE INTO confirmations (id, created_at, report_id, device_hash)
    VALUES (:id, '2026-07-06T10:05:00Z', :report_id, :device_hash)
");

foreach ([
    ['cnf_1', 'report-unit', 'device-a'],
    ['cnf_2', 'report-unit', 'device-b'],
    ['cnf_3', 'report-unit', 'device-b'],
    ['cnf_4', 'legacy-json-only', 'device-c'],
] as $row) {
    $insertConfirmation->execute([
        ':id' => $row[0],
        ':report_id' => $row[1],
        ':device_hash' => $row[2],
    ]);
}

assert_same(2, admin_export_public_reports($pdo), 'First export should keep one legacy report and add one DB report.');
assert_same(2, admin_export_public_reports($pdo), 'Second export should be idempotent.');

$export = json_decode((string)file_get_contents($reportsPath), true);
if (!is_array($export)) {
    fail_test('Export is not valid JSON.');
}

$reportsById = [];
foreach ($export['reports'] ?? [] as $report) {
    $reportsById[(string)$report['id']] = $report;
}

assert_same(4, (int)$reportsById['report-unit']['confirmation_count'], 'DB report count should be base confirmations plus unique device confirmations.');
assert_same(7, (int)$reportsById['legacy-json-only']['confirmation_count'], 'JSON-only report should not double-count device confirmations on repeated exports.');

echo "admin_export_confirmation_test OK\n";

