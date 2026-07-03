<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

try {
    whites_require_method('POST');
    $data = whites_request_data();

    $area = whites_text($data, 'area', 120);
    if ($area === '') {
        $area = whites_text($data, 'city_or_area', 120);
    }

    $region = whites_text($data, 'region', 80);
    $operator = whites_text($data, 'operator', 80);
    $network = whites_text($data, 'network_type', 80);
    if ($network === '') {
        $network = whites_text($data, 'network', 80);
    }

    $problem = whites_text($data, 'problem_type', 120);
    if ($problem === '') {
        $problem = whites_text($data, 'problem', 120);
    }

    $confidence = whites_text($data, 'confidence', 80);
    $summary = whites_text($data, 'summary', 500);
    $checkedAt = whites_text($data, 'checked_at', 40);
    if ($checkedAt === '') {
        $checkedAt = whites_now();
    }

    $services = whites_list($data, 'services');
    $flags = whites_safety_flags([$area, $region, $operator, $summary, implode(', ', $services)]);

    if ($area === '' && $region === '') {
        whites_fail('missing_area', 'Укажите город, район или регион.', 422);
    }
    if ($operator === '') {
        whites_fail('missing_operator', 'Укажите оператора или провайдера.', 422);
    }
    if ($problem === '') {
        whites_fail('missing_problem', 'Укажите тип проблемы.', 422);
    }

    $payload = [
        'region' => $region,
        'city_or_area' => $area,
        'operator' => $operator,
        'network_type' => $network,
        'problem_type' => $problem,
        'incident_category' => whites_incident_category($problem),
        'checked_services' => $services,
        'checked_at' => $checkedAt,
        'confidence' => $confidence,
        'summary' => $summary,
    ];

    if (whites_bool($data, 'test_mode')) {
        whites_json([
            'ok' => true,
            'test' => true,
            'status' => 'pending_review',
            'safety_flags' => $flags,
        ]);
    }

    $id = whites_id('sub_');
    $pdo = whites_db();
    $stmt = $pdo->prepare("
        INSERT INTO submissions (
            id, created_at, status, region, city_or_area, operator, network_type,
            problem_type, incident_category, checked_services_json, checked_at,
            confidence, summary, safety_flags_json, payload_json
        ) VALUES (
            :id, :created_at, 'pending_review', :region, :city_or_area, :operator, :network_type,
            :problem_type, :incident_category, :checked_services_json, :checked_at,
            :confidence, :summary, :safety_flags_json, :payload_json
        )
    ");
    $stmt->execute([
        ':id' => $id,
        ':created_at' => whites_now(),
        ':region' => $region,
        ':city_or_area' => $area,
        ':operator' => $operator,
        ':network_type' => $network,
        ':problem_type' => $problem,
        ':incident_category' => $payload['incident_category'],
        ':checked_services_json' => json_encode($services, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ':checked_at' => $checkedAt,
        ':confidence' => $confidence,
        ':summary' => $summary,
        ':safety_flags_json' => json_encode($flags, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ':payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    whites_json([
        'ok' => true,
        'id' => $id,
        'status' => 'pending_review',
        'safety_flags' => $flags,
        'message' => 'Отчет принят в премодерацию.',
    ], 201);
} catch (Throwable $error) {
    whites_fail('storage_unavailable', 'Сейчас не удалось сохранить отчет. Скопируйте черновик или отправьте его через Telegram.', 500);
}
