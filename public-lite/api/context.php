<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'message' => 'Method not allowed.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$regionHint = trim((string)(getenv('WHITES_REGION_HINT') ?: ''));

echo json_encode([
    'ok' => true,
    'region_hint' => $regionHint !== '' ? $regionHint : null,
    'confidence' => $regionHint !== '' ? 'low' : 'none',
    'source' => $regionHint !== '' ? 'server_config' : 'manual_required',
    'message' => $regionHint !== ''
        ? 'Регион подсказан сервером приблизительно. Его можно изменить вручную.'
        : 'Выберите регион вручную. Где белые списки? не использует IP для публичной идентификации.'
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
