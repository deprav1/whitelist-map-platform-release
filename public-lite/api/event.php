<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

try {
    whites_require_method('POST');
    $data = whites_request_data();
    $event = whites_text($data, 'event', 60);

    if ($event === '' || !whites_is_allowed_event($event)) {
        whites_fail('invalid_event', 'Это событие не входит в белый список.', 422, [
            'allowed_events' => whites_allowed_events(),
        ]);
    }

    $pdo = whites_db();
    $count = whites_record_event($pdo, $event);

    whites_json([
        'ok' => true,
        'event' => $event,
        'count' => $count,
    ], 201);
} catch (Throwable $error) {
    whites_fail('event_unavailable', 'Сейчас не удалось сохранить событие.', 500);
}
