<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

try {
    whites_require_method('POST');
    $data = whites_request_data();

    $reportId = whites_text($data, 'report_id', 80);
    $deviceId = whites_text($data, 'device_id', 80);

    if ($reportId === '') {
        whites_fail('missing_report_id', 'Не найден id публичной отметки.', 422);
    }
    if ($deviceId === '') {
        whites_fail('missing_device_id', 'Не найден идентификатор устройства.', 422);
    }

    // Не храним сырой device_id — только неотслеживаемый хеш для дедупликации.
    $deviceHash = hash('sha256', $reportId . '|' . $deviceId);

    if (whites_bool($data, 'test_mode')) {
        whites_json([
            'ok' => true,
            'test' => true,
            'report_id' => $reportId,
        ]);
    }

    $pdo = whites_db();
    // UNIQUE(report_id, device_hash) даёт rate-limit «одно подтверждение на устройство».
    $stmt = $pdo->prepare("
        INSERT OR IGNORE INTO confirmations (id, created_at, report_id, device_hash)
        VALUES (:id, :created_at, :report_id, :device_hash)
    ");
    $stmt->execute([
        ':id' => whites_id('cnf_'),
        ':created_at' => whites_now(),
        ':report_id' => $reportId,
        ':device_hash' => $deviceHash,
    ]);
    $accepted = $stmt->rowCount() > 0;

    $countStmt = $pdo->prepare('SELECT COUNT(*) AS c FROM confirmations WHERE report_id = :report_id');
    $countStmt->execute([':report_id' => $reportId]);
    $deviceConfirmations = (int)($countStmt->fetch()['c'] ?? 0);

    whites_json([
        'ok' => true,
        'report_id' => $reportId,
        'accepted' => $accepted,
        'already_confirmed' => !$accepted,
        'device_confirmations' => $deviceConfirmations,
        'message' => $accepted ? 'Подтверждение учтено.' : 'Вы уже подтверждали эту отметку.',
    ], $accepted ? 201 : 200);
} catch (Throwable $error) {
    whites_fail('storage_unavailable', 'Сейчас не удалось сохранить подтверждение.', 500);
}
