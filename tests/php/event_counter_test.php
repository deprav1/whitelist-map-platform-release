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

$tmpRoot = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'whites-event-counter-' . bin2hex(random_bytes(4));
$dataDir = $tmpRoot . DIRECTORY_SEPARATOR . 'data';

if (!mkdir($dataDir, 0700, true) && !is_dir($dataDir)) {
    fail_test('Cannot create temp data directory.');
}

putenv('WHITES_DATA_DIR=' . $dataDir);

require __DIR__ . '/../../public-lite/api/_bootstrap.php';

$pdo = whites_db();

assert_same(1, whites_record_event($pdo, 'share_clicked', '2026-07-06'), 'First event should create a daily row.');
assert_same(2, whites_record_event($pdo, 'share_clicked', '2026-07-06'), 'Second event should increment the same daily row.');
assert_same(1, whites_record_event($pdo, 'confirm_clicked', '2026-07-06'), 'Different event should have its own counter.');

$row = $pdo
    ->query("SELECT day, event, count FROM events_daily WHERE day = '2026-07-06' AND event = 'share_clicked'")
    ->fetch();

assert_same('2026-07-06', (string)$row['day'], 'Stored day mismatch.');
assert_same('share_clicked', (string)$row['event'], 'Stored event mismatch.');
assert_same(2, (int)$row['count'], 'Stored count mismatch.');

$columns = $pdo->query('PRAGMA table_info(events_daily)')->fetchAll();
$columnNames = array_map(static fn (array $column): string => (string)$column['name'], $columns);
sort($columnNames);
assert_same(['count', 'day', 'event', 'updated_at'], $columnNames, 'events_daily must only contain aggregate fields.');

try {
    whites_record_event($pdo, 'raw_user_path', '2026-07-06');
    fail_test('Disallowed events must be rejected.');
} catch (InvalidArgumentException) {
    // Expected.
}

echo "event_counter_test OK\n";

