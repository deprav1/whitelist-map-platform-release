<?php
declare(strict_types=1);

/**
 * Front-controller для расшаренных ссылок ?report=<id> / ?region=<slug>.
 * Отдаёт тот же index.html (SPA грузится как обычно), но с контекстными
 * Open Graph мета: динамическая картинка api/og.php + точный заголовок.
 * Так превью в мессенджерах соответствует конкретной отметке/региону.
 */

$indexPath = __DIR__ . '/index.html';
$html = is_file($indexPath) ? (string)file_get_contents($indexPath) : '';
if ($html === '') {
    http_response_code(500);
    exit;
}

function sv_clean(string $s, int $max = 80): string
{
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '';
    $s = trim(preg_replace('/\s{2,}/u', ' ', $s) ?? '');
    return mb_substr($s, 0, $max, 'UTF-8');
}

$reportId = isset($_GET['report']) ? sv_clean((string)$_GET['report'], 80) : '';
$regionSlug = isset($_GET['region']) ? sv_clean((string)$_GET['region'], 80) : '';

// Абсолютная база из запроса (работает и на /whites/, и на будущем субдомене).
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = (string)($_SERVER['HTTP_HOST'] ?? 'kidai.website');
$dir = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/share.php'))), '/');
$base = "{$scheme}://{$host}{$dir}/";

// Данные для заголовка отметки/региона.
$data = json_decode((string)@file_get_contents(__DIR__ . '/reports.json'), true);
$reports = is_array($data['reports'] ?? null) ? $data['reports'] : [];
$categoryLabels = [
    'internet-shutdown' => 'полное отключение',
    'whitelist-only' => 'режим белого списка',
    'partial-connectivity' => 'частичные сбои',
    'restored' => 'доступ восстановлен',
    'needs-verification' => 'требует проверки',
];

function sv_slug(string $name): string
{
    $s = mb_strtolower($name, 'UTF-8');
    $s = str_replace('ё', 'е', $s);
    return trim(preg_replace('/[^\p{L}\p{N}]+/u', '-', $s) ?? '', '-');
}

$ogImage = $base . 'api/og.php';
$ogUrl = $base;
$ogTitle = 'WhiteS — карта доступности интернета в России';
$ogDesc = 'Публичная карта WhiteS показывает, где сообщают об отключениях интернета, режиме белого списка, частичных сбоях и восстановлении доступа.';

if ($reportId !== '') {
    foreach ($reports as $r) {
        if (($r['id'] ?? '') === $reportId && (!isset($r['status']) || $r['status'] === 'published')) {
            $cat = $categoryLabels[$r['incident_category'] ?? 'needs-verification'] ?? 'сообщение';
            $confirms = (int)($r['confirmation_count'] ?? 0);
            $ogImage = $base . 'api/og.php?report=' . rawurlencode($reportId);
            $ogUrl = $base . '?report=' . rawurlencode($reportId);
            $ogTitle = sv_clean(($r['city_or_area'] ?? '') . ', ' . ($r['operator'] ?? '') . ' — ' . $cat, 90);
            $ogDesc = $confirms > 0
                ? "Отметку подтвердили {$confirms} человек. Проверьте свой регион на карте WhiteS."
                : 'Проверьте доступность интернета в своём регионе на карте WhiteS. Без регистрации и личных данных.';
            break;
        }
    }
} elseif ($regionSlug !== '') {
    foreach ($reports as $r) {
        if (sv_slug((string)($r['region'] ?? '')) === $regionSlug) {
            $region = sv_clean((string)$r['region'], 60);
            $ogImage = $base . 'api/og.php?region=' . rawurlencode($regionSlug);
            $ogUrl = $base . '?region=' . rawurlencode($regionSlug);
            $ogTitle = "{$region}: доступность интернета — WhiteS";
            $ogDesc = "Актуальные пользовательские отметки об отключениях и сбоях в регионе «{$region}» на карте WhiteS.";
            break;
        }
    }
}

$e = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');

// Подменяем значения соответствующих мета-тегов.
$replacements = [
    '/(<meta\s+property="og:image"\s+content=")[^"]*(")/i' => '${1}' . $e($ogImage) . '${2}',
    '/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/i' => '${1}' . $e($ogImage) . '${2}',
    '/(<meta\s+property="og:url"\s+content=")[^"]*(")/i' => '${1}' . $e($ogUrl) . '${2}',
    '/(<meta\s+property="og:title"\s+content=")[^"]*(")/i' => '${1}' . $e($ogTitle) . '${2}',
    '/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i' => '${1}' . $e($ogTitle) . '${2}',
    '/(<meta\s+property="og:description"\s+content=")[^"]*(")/i' => '${1}' . $e($ogDesc) . '${2}',
    '/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/i' => '${1}' . $e($ogDesc) . '${2}',
];
foreach ($replacements as $pattern => $replacement) {
    $html = preg_replace($pattern, $replacement, $html, 1) ?? $html;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo $html;
