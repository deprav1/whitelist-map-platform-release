<?php
declare(strict_types=1);

require __DIR__ . '/../api/_bootstrap.php';

session_start();

function admin_h(mixed $value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function admin_token_path(): string
{
    return whites_data_dir() . DIRECTORY_SEPARATOR . 'admin-token.txt';
}

function admin_expected_token(): string
{
    $env = getenv('WHITES_ADMIN_TOKEN');
    if (is_string($env) && trim($env) !== '') {
        return trim($env);
    }

    $path = admin_token_path();
    if (is_file($path) && is_readable($path)) {
        return trim((string)file_get_contents($path));
    }

    return '';
}

function admin_is_authenticated(): bool
{
    return isset($_SESSION['whites_admin_ok']) && $_SESSION['whites_admin_ok'] === true;
}

function admin_flash(?string $message = null, string $tone = 'info'): ?array
{
    if ($message !== null) {
        $_SESSION['whites_admin_flash'] = ['message' => $message, 'tone' => $tone];
        return null;
    }

    $flash = $_SESSION['whites_admin_flash'] ?? null;
    unset($_SESSION['whites_admin_flash']);
    return is_array($flash) ? $flash : null;
}

function admin_csrf(): string
{
    if (empty($_SESSION['whites_admin_csrf'])) {
        $_SESSION['whites_admin_csrf'] = bin2hex(random_bytes(16));
    }
    return (string)$_SESSION['whites_admin_csrf'];
}

function admin_verify_csrf(array $data): void
{
    $token = (string)($data['csrf'] ?? '');
    if ($token === '' || !hash_equals(admin_csrf(), $token)) {
        throw new RuntimeException('Сессия устарела. Обновите страницу и повторите действие.');
    }
}

function admin_redirect(): never
{
    header('Location: ' . strtok((string)($_SERVER['REQUEST_URI'] ?? 'index.php'), '?'));
    exit;
}

function admin_json_decode(?string $json): array
{
    $decoded = json_decode((string)$json, true);
    return is_array($decoded) ? $decoded : [];
}

function admin_reports_path(): string
{
    $envPath = getenv('WHITES_REPORTS_PATH');
    if (is_string($envPath) && trim($envPath) !== '') {
        return trim($envPath);
    }

    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'reports.json';
}

function admin_freshness(string $checkedAt): string
{
    $timestamp = strtotime($checkedAt);
    if ($timestamp === false) {
        return 'stale';
    }

    $age = time() - $timestamp;
    if ($age <= 3 * 60 * 60) {
        return 'now';
    }
    if ($age <= 24 * 60 * 60) {
        return 'today';
    }
    if ($age <= 7 * 24 * 60 * 60) {
        return 'recent';
    }
    return 'stale';
}

function admin_confirmation_counts(PDO $pdo): array
{
    $counts = [];
    $rows = $pdo->query('SELECT report_id, COUNT(*) AS c FROM confirmations GROUP BY report_id')->fetchAll();
    foreach ($rows as $row) {
        $reportId = (string)($row['report_id'] ?? '');
        if ($reportId !== '') {
            $counts[$reportId] = (int)($row['c'] ?? 0);
        }
    }

    return $counts;
}

function admin_public_report_from_row(array $row, int $deviceConfirmations = 0): array
{
    $baseConfirmations = max(0, (int)($row['confirmation_count'] ?? 0));
    $confirmationCount = min(999, $baseConfirmations + max(0, $deviceConfirmations));

    $report = [
        'id' => $row['id'],
        'status' => 'published',
        'region' => $row['region'],
        'city_or_area' => $row['city_or_area'],
        'operator' => $row['operator'],
        'network_type' => $row['network_type'],
        'problem_type' => $row['problem_type'],
        'incident_category' => $row['incident_category'],
        'checked_services' => admin_json_decode($row['checked_services_json'] ?? '[]'),
        'checked_at' => $row['checked_at'],
        'confidence' => $row['confidence'],
        'confirmation_count' => $confirmationCount,
        'freshness' => admin_freshness((string)$row['checked_at']),
        'summary' => $row['summary'],
    ];

    if ($row['approx_lat'] !== null && $row['approx_lon'] !== null) {
        $report['approx_location'] = [
            'lat' => (float)$row['approx_lat'],
            'lon' => (float)$row['approx_lon'],
            'precision' => $row['approx_precision'] ?: 'city',
        ];
    }

    return $report;
}

function admin_export_public_reports(PDO $pdo): int
{
    $path = admin_reports_path();
    $existing = [
        'updated_at' => '',
        'source' => 'WhiteS moderated public reports',
        'disclaimer' => 'Пользовательские отметки, не официальные данные. Проверяйте свежесть и уровень уверенности.',
        'reports' => [],
    ];

    if (is_file($path)) {
        $decoded = json_decode((string)file_get_contents($path), true);
        if (is_array($decoded)) {
            $existing = array_merge($existing, $decoded);
        }
    }

    $reportsById = [];
    foreach (($existing['reports'] ?? []) as $report) {
        if (is_array($report) && ($report['status'] ?? 'published') === 'published' && !empty($report['id'])) {
            $reportsById[(string)$report['id']] = $report;
        }
    }

    $confirmationCounts = admin_confirmation_counts($pdo);
    $rows = $pdo->query("SELECT * FROM public_reports WHERE status = 'published'")->fetchAll();
    foreach ($rows as $row) {
        $reportId = (string)($row['id'] ?? '');
        $report = admin_public_report_from_row($row, $confirmationCounts[$reportId] ?? 0);
        $reportsById[$report['id']] = $report;
    }

    $reports = array_values($reportsById);
    usort($reports, static function (array $a, array $b): int {
        return strcmp((string)($b['checked_at'] ?? ''), (string)($a['checked_at'] ?? ''));
    });

    $now = new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow'));
    $export = [
        'updated_at' => $now->format('Y-m-d\TH:i:sP'),
        'source' => 'WhiteS moderated public reports',
        'disclaimer' => 'Пользовательские отметки, не официальные данные. Проверяйте свежесть и уровень уверенности.',
        'reports' => $reports,
    ];

    $json = json_encode($export, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        throw new RuntimeException('Не удалось собрать reports.json.');
    }

    $tmp = $path . '.tmp';
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Не удалось записать временный reports.json.');
    }
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Не удалось заменить reports.json.');
    }

    return count($reports);
}

function admin_insert_event(PDO $pdo, string $type, string $id, string $action, string $note = ''): void
{
    $stmt = $pdo->prepare("
        INSERT INTO moderation_events (id, created_at, entity_type, entity_id, action, note)
        VALUES (:id, :created_at, :entity_type, :entity_id, :action, :note)
    ");
    $stmt->execute([
        ':id' => whites_id('evt_'),
        ':created_at' => whites_now(),
        ':entity_type' => $type,
        ':entity_id' => $id,
        ':action' => $action,
        ':note' => whites_clean_text($note, 500),
    ]);
}

function admin_valid_category(string $category): string
{
    $allowed = ['internet-shutdown', 'whitelist-only', 'partial-connectivity', 'restored', 'needs-verification'];
    return in_array($category, $allowed, true) ? $category : 'needs-verification';
}

function admin_valid_precision(string $precision): string
{
    $allowed = ['region', 'city', 'district'];
    return in_array($precision, $allowed, true) ? $precision : 'city';
}

function admin_publish_submission(PDO $pdo, array $data): void
{
    $submissionId = whites_text($data, 'submission_id', 80);
    $publicId = whites_text($data, 'public_id', 80);
    if ($publicId === '') {
        $publicId = 'report-' . bin2hex(random_bytes(4));
    }

    $region = whites_text($data, 'region', 80);
    $city = whites_text($data, 'city_or_area', 120);
    $operator = whites_text($data, 'operator', 80);
    $network = whites_text($data, 'network_type', 80);
    $problem = whites_text($data, 'problem_type', 120);
    $category = admin_valid_category(whites_text($data, 'incident_category', 40));
    $services = whites_list($data, 'checked_services', 12);
    $checkedAt = whites_text($data, 'checked_at', 40);
    $confidence = whites_text($data, 'confidence', 80);
    $summary = whites_text($data, 'summary', 500);
    $confirmationCount = max(1, min(999, (int)($data['confirmation_count'] ?? 1)));

    if ($region === '' || $city === '' || $operator === '' || $network === '' || $problem === '' || $checkedAt === '' || $summary === '') {
        throw new RuntimeException('Для публикации нужны регион, район/город, оператор, сеть, проблема, время и короткое описание.');
    }

    $flags = whites_safety_flags([$region, $city, $operator, $summary]);
    if ($flags !== []) {
        throw new RuntimeException('Публичные поля похожи на персональные данные: ' . implode(', ', $flags));
    }

    $lat = whites_text($data, 'approx_lat', 32);
    $lon = whites_text($data, 'approx_lon', 32);
    $latValue = null;
    $lonValue = null;
    if ($lat !== '' || $lon !== '') {
        if (!is_numeric($lat) || !is_numeric($lon)) {
            throw new RuntimeException('Координаты должны быть числами или пустыми.');
        }
        $latValue = (float)$lat;
        $lonValue = (float)$lon;
        if ($latValue < -90 || $latValue > 90 || $lonValue < -180 || $lonValue > 180) {
            throw new RuntimeException('Координаты вне допустимого диапазона.');
        }
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO public_reports (
                id, updated_at, status, region, city_or_area, operator, network_type,
                problem_type, incident_category, checked_services_json, checked_at,
                confidence, confirmation_count, summary, approx_lat, approx_lon, approx_precision
            ) VALUES (
                :id, :updated_at, 'published', :region, :city_or_area, :operator, :network_type,
                :problem_type, :incident_category, :checked_services_json, :checked_at,
                :confidence, :confirmation_count, :summary, :approx_lat, :approx_lon, :approx_precision
            )
            ON CONFLICT(id) DO UPDATE SET
                updated_at = excluded.updated_at,
                status = 'published',
                region = excluded.region,
                city_or_area = excluded.city_or_area,
                operator = excluded.operator,
                network_type = excluded.network_type,
                problem_type = excluded.problem_type,
                incident_category = excluded.incident_category,
                checked_services_json = excluded.checked_services_json,
                checked_at = excluded.checked_at,
                confidence = excluded.confidence,
                confirmation_count = excluded.confirmation_count,
                summary = excluded.summary,
                approx_lat = excluded.approx_lat,
                approx_lon = excluded.approx_lon,
                approx_precision = excluded.approx_precision
        ");
        $stmt->execute([
            ':id' => $publicId,
            ':updated_at' => whites_now(),
            ':region' => $region,
            ':city_or_area' => $city,
            ':operator' => $operator,
            ':network_type' => $network,
            ':problem_type' => $problem,
            ':incident_category' => $category,
            ':checked_services_json' => json_encode($services, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':checked_at' => $checkedAt,
            ':confidence' => $confidence,
            ':confirmation_count' => $confirmationCount,
            ':summary' => $summary,
            ':approx_lat' => $latValue,
            ':approx_lon' => $lonValue,
            ':approx_precision' => $latValue === null ? null : admin_valid_precision(whites_text($data, 'approx_precision', 20)),
        ]);

        $update = $pdo->prepare("UPDATE submissions SET status = 'published' WHERE id = :id");
        $update->execute([':id' => $submissionId]);
        admin_insert_event($pdo, 'submission', $submissionId, 'published', 'public_id=' . $publicId);
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    $count = admin_export_public_reports($pdo);
    admin_flash('Опубликовано как ' . $publicId . '. reports.json обновлен, записей: ' . $count . '.', 'success');
}

function admin_reject_submission(PDO $pdo, array $data): void
{
    $id = whites_text($data, 'submission_id', 80);
    $note = whites_text($data, 'note', 500);
    $stmt = $pdo->prepare("UPDATE submissions SET status = 'rejected' WHERE id = :id");
    $stmt->execute([':id' => $id]);
    admin_insert_event($pdo, 'submission', $id, 'rejected', $note);
    admin_flash('Заявка отклонена.', 'success');
}

function admin_close_complaint(PDO $pdo, array $data): void
{
    $id = whites_text($data, 'complaint_id', 80);
    $note = whites_text($data, 'note', 500);
    $stmt = $pdo->prepare("UPDATE complaints SET status = 'closed' WHERE id = :id");
    $stmt->execute([':id' => $id]);
    admin_insert_event($pdo, 'complaint', $id, 'closed', $note);
    admin_flash('Жалоба закрыта.', 'success');
}

function admin_product_events(PDO $pdo): array
{
    return $pdo
        ->query("SELECT day, event, count, updated_at FROM events_daily ORDER BY day DESC, event ASC LIMIT 100")
        ->fetchAll();
}

$expectedToken = admin_expected_token();
$authError = '';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    try {
        $post = $_POST;
        $action = (string)($post['action'] ?? '');

        if ($action === 'login') {
            $token = (string)($post['token'] ?? '');
            if ($expectedToken !== '' && hash_equals($expectedToken, $token)) {
                $_SESSION['whites_admin_ok'] = true;
                admin_csrf();
                admin_redirect();
            }
            $authError = 'Неверный токен.';
        } elseif ($action === 'logout') {
            $_SESSION = [];
            session_destroy();
            admin_redirect();
        } elseif (admin_is_authenticated()) {
            admin_verify_csrf($post);
            $pdo = whites_db();
            if ($action === 'publish_submission') {
                admin_publish_submission($pdo, $post);
            } elseif ($action === 'reject_submission') {
                admin_reject_submission($pdo, $post);
            } elseif ($action === 'close_complaint') {
                admin_close_complaint($pdo, $post);
            } elseif ($action === 'export_public') {
                $count = admin_export_public_reports($pdo);
                admin_insert_event($pdo, 'public_reports', 'reports.json', 'exported', 'count=' . $count);
                admin_flash('reports.json пересобран, записей: ' . $count . '.', 'success');
            }
            admin_redirect();
        }
    } catch (Throwable $error) {
        admin_flash($error->getMessage(), 'error');
        admin_redirect();
    }
}

$isReady = $expectedToken !== '';
$isAuthenticated = admin_is_authenticated() && $isReady;
$flash = admin_flash();
$pdo = $isAuthenticated ? whites_db() : null;
$submissions = $pdo ? $pdo->query("SELECT * FROM submissions WHERE status = 'pending_review' ORDER BY created_at DESC LIMIT 50")->fetchAll() : [];
$complaints = $pdo ? $pdo->query("SELECT * FROM complaints WHERE status = 'open' ORDER BY created_at DESC LIMIT 50")->fetchAll() : [];
$events = $pdo ? $pdo->query("SELECT * FROM moderation_events ORDER BY created_at DESC LIMIT 20")->fetchAll() : [];
$productEvents = $pdo ? admin_product_events($pdo) : [];

?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>WhiteS Moderation</title>
  <style>
    :root { color-scheme: dark; --bg: #0f1117; --panel: #171b24; --muted: #9aa4b2; --line: #2d3442; --ink: #f8fafc; --brand: #10b981; --bad: #ef4444; --warn: #f59e0b; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; }
    a { color: #86efac; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 24px; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    h1, h2, h3 { margin: 0; line-height: 1.2; }
    h1 { font-size: 24px; }
    h2 { margin-top: 28px; font-size: 18px; }
    h3 { font-size: 16px; }
    .muted { color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .card, .login { padding: 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
    .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .pill { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #243044; color: #dbeafe; font-size: 12px; font-weight: 700; }
    .flags { color: #fca5a5; }
    label { display: grid; gap: 4px; color: #dbe3ef; font-weight: 700; }
    input, textarea, select { width: 100%; border: 1px solid #4b5567; border-radius: 6px; background: #242a36; color: var(--ink); padding: 8px 10px; font: inherit; }
    textarea { min-height: 72px; resize: vertical; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .wide { grid-column: 1 / -1; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    button { border: 1px solid transparent; border-radius: 6px; min-height: 36px; padding: 0 12px; color: #fff; background: var(--brand); font-weight: 800; cursor: pointer; }
    button.secondary { background: #293142; border-color: #4b5567; }
    button.danger { background: var(--bad); }
    .flash { margin: 0 0 16px; padding: 10px 12px; border-radius: 6px; background: #1f2937; border: 1px solid var(--line); }
    .flash.success { border-color: rgba(16,185,129,.55); }
    .flash.error { border-color: rgba(239,68,68,.65); color: #fecaca; }
    .empty { padding: 16px; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); }
    .event { padding: 10px 0; border-bottom: 1px solid var(--line); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 520px; }
    th, td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: left; }
    th { color: #dbe3ef; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    td:last-child, th:last-child { text-align: right; }
    @media (max-width: 760px) { .shell { padding: 16px; } .grid, .form-grid { grid-template-columns: 1fr; } .top { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="top">
      <div>
        <h1>WhiteS Moderation</h1>
        <p class="muted">Публикуйте только обобщенные, безопасные и проверенные поля.</p>
      </div>
      <?php if ($isAuthenticated): ?>
        <form method="post">
          <input type="hidden" name="action" value="logout">
          <button class="secondary" type="submit">Выйти</button>
        </form>
      <?php endif; ?>
    </header>

    <?php if ($flash): ?>
      <p class="flash <?= admin_h($flash['tone'] ?? 'info') ?>"><?= admin_h($flash['message'] ?? '') ?></p>
    <?php endif; ?>

    <?php if (!$isReady): ?>
      <section class="login">
        <h2>Админка не активирована</h2>
        <p class="muted">Создайте приватный токен в файле вне public_html:</p>
        <pre><?= admin_h(admin_token_path()) ?></pre>
      </section>
    <?php elseif (!$isAuthenticated): ?>
      <form class="login" method="post">
        <input type="hidden" name="action" value="login">
        <label>
          <span>Админ-токен</span>
          <input name="token" type="password" autocomplete="current-password" autofocus>
        </label>
        <?php if ($authError !== ''): ?><p class="flash error"><?= admin_h($authError) ?></p><?php endif; ?>
        <div class="actions"><button type="submit">Войти</button></div>
      </form>
    <?php else: ?>
      <section class="actions">
        <form method="post">
          <input type="hidden" name="csrf" value="<?= admin_h(admin_csrf()) ?>">
          <input type="hidden" name="action" value="export_public">
          <button class="secondary" type="submit">Пересобрать reports.json</button>
        </form>
        <a href="../reports.json" target="_blank" rel="noopener">Открыть public JSON</a>
      </section>

      <h2>События продукта</h2>
      <p class="muted">Агрегаты по дням: только event/day/count. Без cookies, IP, user-agent, user id, referrer и URL.</p>
      <?php if (!$productEvents): ?>
        <p class="empty">Событий пока нет.</p>
      <?php else: ?>
        <section class="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>День</th>
                <th>Событие</th>
                <th>Обновлено</th>
                <th>Счётчик</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($productEvents as $event): ?>
                <tr>
                  <td><?= admin_h($event['day']) ?></td>
                  <td><?= admin_h($event['event']) ?></td>
                  <td><?= admin_h($event['updated_at']) ?></td>
                  <td><?= admin_h($event['count']) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </section>
      <?php endif; ?>

      <h2>Очередь отчетов (<?= count($submissions) ?>)</h2>
      <?php if (!$submissions): ?>
        <p class="empty">Новых отчетов в премодерации нет.</p>
      <?php else: ?>
        <section class="grid">
          <?php foreach ($submissions as $item): ?>
            <?php
              $services = admin_json_decode($item['checked_services_json'] ?? '[]');
              $flags = admin_json_decode($item['safety_flags_json'] ?? '[]');
            ?>
            <article class="card">
              <div class="card-head">
                <div>
                  <h3><?= admin_h($item['city_or_area'] ?: $item['region']) ?> · <?= admin_h($item['operator']) ?></h3>
                  <p class="muted"><?= admin_h($item['created_at']) ?> · <?= admin_h($item['id']) ?></p>
                </div>
                <span class="pill"><?= admin_h($item['incident_category']) ?></span>
              </div>
              <?php if ($flags): ?><p class="flags">Флаги: <?= admin_h(implode(', ', $flags)) ?></p><?php endif; ?>
              <p><?= admin_h($item['summary'] ?: 'Без комментария') ?></p>
              <form method="post">
                <input type="hidden" name="csrf" value="<?= admin_h(admin_csrf()) ?>">
                <input type="hidden" name="action" value="publish_submission">
                <input type="hidden" name="submission_id" value="<?= admin_h($item['id']) ?>">
                <div class="form-grid">
                  <label><span>Public id</span><input name="public_id" placeholder="пусто = случайный id"></label>
                  <label><span>Регион</span><input name="region" value="<?= admin_h($item['region']) ?>" required></label>
                  <label><span>Город/район</span><input name="city_or_area" value="<?= admin_h($item['city_or_area']) ?>" required></label>
                  <label><span>Оператор</span><input name="operator" value="<?= admin_h($item['operator']) ?>" required></label>
                  <label><span>Сеть</span><input name="network_type" value="<?= admin_h($item['network_type']) ?>" required></label>
                  <label><span>Проблема</span><input name="problem_type" value="<?= admin_h($item['problem_type']) ?>" required></label>
                  <label>
                    <span>Категория</span>
                    <select name="incident_category">
                      <?php foreach (['internet-shutdown','whitelist-only','partial-connectivity','restored','needs-verification'] as $category): ?>
                        <option value="<?= admin_h($category) ?>" <?= $category === $item['incident_category'] ? 'selected' : '' ?>><?= admin_h($category) ?></option>
                      <?php endforeach; ?>
                    </select>
                  </label>
                  <label><span>Уверенность</span><input name="confidence" value="<?= admin_h($item['confidence']) ?>"></label>
                  <label><span>Время проверки</span><input name="checked_at" value="<?= admin_h($item['checked_at']) ?>" required></label>
                  <label><span>Подтверждений</span><input name="confirmation_count" type="number" min="1" max="999" value="1"></label>
                  <label><span>Широта примерно</span><input name="approx_lat" inputmode="decimal" placeholder="опционально"></label>
                  <label><span>Долгота примерно</span><input name="approx_lon" inputmode="decimal" placeholder="опционально"></label>
                  <label>
                    <span>Точность</span>
                    <select name="approx_precision">
                      <option value="city">city</option>
                      <option value="district">district</option>
                      <option value="region">region</option>
                    </select>
                  </label>
                  <label class="wide"><span>Сервисы</span><input name="checked_services" value="<?= admin_h(implode(', ', $services)) ?>"></label>
                  <label class="wide"><span>Публичное описание после чистки</span><textarea name="summary" required><?= admin_h($item['summary']) ?></textarea></label>
                </div>
                <div class="actions">
                  <button type="submit">Опубликовать и экспортировать</button>
                </div>
              </form>
              <form method="post" class="actions">
                <input type="hidden" name="csrf" value="<?= admin_h(admin_csrf()) ?>">
                <input type="hidden" name="action" value="reject_submission">
                <input type="hidden" name="submission_id" value="<?= admin_h($item['id']) ?>">
                <input name="note" placeholder="Причина отклонения">
                <button class="danger" type="submit">Отклонить</button>
              </form>
            </article>
          <?php endforeach; ?>
        </section>
      <?php endif; ?>

      <h2>Жалобы (<?= count($complaints) ?>)</h2>
      <?php if (!$complaints): ?>
        <p class="empty">Открытых жалоб нет.</p>
      <?php else: ?>
        <section class="grid">
          <?php foreach ($complaints as $item): ?>
            <?php $flags = admin_json_decode($item['safety_flags_json'] ?? '[]'); ?>
            <article class="card">
              <div class="card-head">
                <div>
                  <h3><?= admin_h($item['report_id']) ?></h3>
                  <p class="muted"><?= admin_h($item['created_at']) ?> · <?= admin_h($item['id']) ?></p>
                </div>
                <span class="pill">complaint</span>
              </div>
              <?php if ($flags): ?><p class="flags">Флаги: <?= admin_h(implode(', ', $flags)) ?></p><?php endif; ?>
              <p><strong>Причина:</strong> <?= admin_h($item['reason']) ?></p>
              <p><?= admin_h($item['comment'] ?: 'Без комментария') ?></p>
              <form method="post" class="actions">
                <input type="hidden" name="csrf" value="<?= admin_h(admin_csrf()) ?>">
                <input type="hidden" name="action" value="close_complaint">
                <input type="hidden" name="complaint_id" value="<?= admin_h($item['id']) ?>">
                <input name="note" placeholder="Что сделано">
                <button type="submit">Закрыть</button>
              </form>
            </article>
          <?php endforeach; ?>
        </section>
      <?php endif; ?>

      <h2>Последние действия</h2>
      <?php if (!$events): ?>
        <p class="empty">Журнал пока пуст.</p>
      <?php else: ?>
        <section class="card">
          <?php foreach ($events as $event): ?>
            <div class="event">
              <strong><?= admin_h($event['action']) ?></strong>
              <span class="muted"><?= admin_h($event['entity_type']) ?> · <?= admin_h($event['entity_id']) ?> · <?= admin_h($event['created_at']) ?></span>
              <?php if ($event['note'] !== ''): ?><div><?= admin_h($event['note']) ?></div><?php endif; ?>
            </div>
          <?php endforeach; ?>
        </section>
      <?php endif; ?>
    <?php endif; ?>
  </main>
</body>
</html>
