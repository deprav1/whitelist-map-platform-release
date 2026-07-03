<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

try {
    whites_require_method('POST');
    $data = whites_request_data();

    $reportId = whites_text($data, 'report_id', 80);
    $reason = whites_text($data, 'reason', 160);
    $comment = whites_text($data, 'comment', 400);
    $flags = whites_safety_flags([$reportId, $reason, $comment]);

    if ($reportId === '') {
        whites_fail('missing_report_id', 'Не найден id публичной отметки.', 422);
    }
    if ($reason === '') {
        whites_fail('missing_reason', 'Укажите причину жалобы.', 422);
    }

    $payload = [
        'report_id' => $reportId,
        'reason' => $reason,
        'comment' => $comment,
    ];

    if (whites_bool($data, 'test_mode')) {
        whites_json([
            'ok' => true,
            'test' => true,
            'status' => 'open',
            'safety_flags' => $flags,
        ]);
    }

    $id = whites_id('cmp_');
    $pdo = whites_db();
    $stmt = $pdo->prepare("
        INSERT INTO complaints (
            id, created_at, status, report_id, reason, comment, safety_flags_json, payload_json
        ) VALUES (
            :id, :created_at, 'open', :report_id, :reason, :comment, :safety_flags_json, :payload_json
        )
    ");
    $stmt->execute([
        ':id' => $id,
        ':created_at' => whites_now(),
        ':report_id' => $reportId,
        ':reason' => $reason,
        ':comment' => $comment,
        ':safety_flags_json' => json_encode($flags, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ':payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    whites_json([
        'ok' => true,
        'id' => $id,
        'status' => 'open',
        'safety_flags' => $flags,
        'message' => 'Жалоба принята в модерацию.',
    ], 201);
} catch (Throwable $error) {
    whites_fail('storage_unavailable', 'Сейчас не удалось сохранить жалобу. Скопируйте черновик или отправьте его через Telegram.', 500);
}
