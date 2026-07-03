<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

try {
    $pdo = whites_db();
    $version = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
    whites_json([
        'ok' => true,
        'storage' => 'sqlite',
        'schema_version' => $version,
        'writable' => is_writable(whites_data_dir()),
    ]);
} catch (Throwable $error) {
    whites_fail('storage_unavailable', 'Хранилище сейчас недоступно.', 500);
}
