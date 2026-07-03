<?php
declare(strict_types=1);

/**
 * Динамический Open Graph image (1200x630 PNG) для мессенджеров.
 * Варианты: главная сводка, ?region=<slug>, ?report=<id>.
 * Только агрегаты и публичные поля — без авторов, адресов, контактов.
 * Если GD/шрифт недоступны — редирект на статичную og-image.png.
 */

const OG_W = 1200;
const OG_H = 630;

function og_font(bool $bold = false): ?string
{
    $candidates = $bold
        ? [__DIR__ . '/fonts/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
        : [__DIR__ . '/fonts/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            return $path;
        }
    }
    return null;
}

function og_fallback(): void
{
    header('Location: ../og-image.png', true, 302);
    exit;
}

if (!function_exists('imagecreatetruecolor') || !function_exists('imagettftext') || og_font() === null) {
    og_fallback();
}

// --- данные ---
$dataPath = __DIR__ . '/../reports.json';
$data = is_file($dataPath) ? json_decode((string)file_get_contents($dataPath), true) : null;
$reports = is_array($data['reports'] ?? null) ? $data['reports'] : [];
$published = array_values(array_filter($reports, static function ($r) {
    return !isset($r['status']) || $r['status'] === 'published';
}));

$categoryLabels = [
    'internet-shutdown' => 'Полное отключение',
    'whitelist-only' => 'Только белый список',
    'partial-connectivity' => 'Частичные сбои',
    'restored' => 'Восстановлено',
    'needs-verification' => 'Требует проверки',
];

function og_clean(string $s, int $max = 80): string
{
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '';
    $s = trim(preg_replace('/\s{2,}/u', ' ', $s) ?? '');
    return mb_substr($s, 0, $max, 'UTF-8');
}

$reportId = isset($_GET['report']) ? og_clean((string)$_GET['report'], 80) : '';
$regionSlug = isset($_GET['region']) ? og_clean((string)$_GET['region'], 80) : '';

// slug как в app.js: нижний регистр, ё->е, не-буквенно-цифровое -> "-"
function og_slug(string $name): string
{
    $s = mb_strtolower($name, 'UTF-8');
    $s = str_replace('ё', 'е', $s);
    $s = preg_replace('/[^\p{L}\p{N}]+/u', '-', $s) ?? '';
    return trim($s, '-');
}

$mode = 'main';
$title = 'Сбои интернета сейчас';
$headline = '';
$subline = '';

if ($reportId !== '') {
    foreach ($published as $r) {
        if (($r['id'] ?? '') === $reportId) {
            $mode = 'report';
            $cat = $categoryLabels[$r['incident_category'] ?? 'needs-verification'] ?? 'Сообщение';
            $title = og_clean(($r['city_or_area'] ?? '') . ', ' . ($r['operator'] ?? ''), 60);
            $headline = $cat;
            $confirms = (int)($r['confirmation_count'] ?? 0);
            $subline = $confirms > 0 ? "Подтвердили: {$confirms}" : 'Отметка на модерации сообщества';
            break;
        }
    }
}

if ($mode === 'main' && $regionSlug !== '') {
    $regionReports = array_values(array_filter($published, static function ($r) use ($regionSlug) {
        return og_slug((string)($r['region'] ?? '')) === $regionSlug;
    }));
    if ($regionReports) {
        $mode = 'region';
        $title = og_clean((string)($regionReports[0]['region'] ?? 'Регион'), 60);
        $weights = ['internet-shutdown' => 4, 'whitelist-only' => 3, 'partial-connectivity' => 2, 'needs-verification' => 1, 'restored' => 0];
        $worst = 'restored';
        foreach ($regionReports as $r) {
            $c = $r['incident_category'] ?? 'needs-verification';
            if (($weights[$c] ?? 1) > ($weights[$worst] ?? 1)) {
                $worst = $c;
            }
        }
        $headline = $categoryLabels[$worst] ?? 'Есть сообщения';
        $subline = count($regionReports) . ' ' . og_plural(count($regionReports), ['отметка', 'отметки', 'отметок']);
    }
}

if ($mode === 'main') {
    $regions = [];
    $problems = 0;
    foreach ($published as $r) {
        $regions[(string)($r['region'] ?? '')] = true;
        if (in_array($r['incident_category'] ?? '', ['internet-shutdown', 'whitelist-only', 'partial-connectivity'], true)) {
            $problems++;
        }
    }
    $regionCount = count(array_filter(array_keys($regions), static fn($k) => $k !== ''));
    $headline = $problems . ' ' . og_plural($problems, ['сбой', 'сбоя', 'сбоев']);
    $subline = 'в ' . $regionCount . ' ' . og_plural($regionCount, ['регионе', 'регионах', 'регионах']);
}

function og_plural(int $n, array $forms): string
{
    $a = abs($n) % 100;
    $b = $a % 10;
    if ($a > 10 && $a < 20) return $forms[2];
    if ($b > 1 && $b < 5) return $forms[1];
    if ($b === 1) return $forms[0];
    return $forms[2];
}

// --- рисование ---
$img = imagecreatetruecolor(OG_W, OG_H);
imagealphablending($img, true);
imagesavealpha($img, true);

$bg = imagecolorallocate($img, 15, 17, 23);       // #0f1117
$bg2 = imagecolorallocate($img, 21, 27, 38);      // #151b26
$white = imagecolorallocate($img, 255, 255, 255);
$muted = imagecolorallocate($img, 154, 164, 178); // #9aa4b2
$emerald = imagecolorallocate($img, 52, 211, 153); // #34d399
$emeraldDim = imagecolorallocate($img, 5, 150, 105);

imagefilledrectangle($img, 0, 0, OG_W, OG_H, $bg);
// диагональный градиент-намёк
for ($y = 0; $y < OG_H; $y += 2) {
    $t = $y / OG_H;
    $r = (int)(15 + (21 - 15) * $t);
    $g = (int)(17 + (27 - 17) * $t);
    $b = (int)(23 + (38 - 23) * $t);
    $c = imagecolorallocate($img, $r, $g, $b);
    imagefilledrectangle($img, 0, $y, OG_W, $y + 2, $c);
}

$fontR = og_font(false);
$fontB = og_font(true);

// бренд-марка
imagesetthickness($img, 5);
imageellipse($img, 138, 150, 74, 74, $emerald);
imageellipse($img, 138, 150, 42, 42, $emeraldDim);
imagefilledellipse($img, 138, 150, 14, 14, $emerald);
imagettftext($img, 42, 0, 200, 168, $white, $fontB, 'WhiteS');

// плашка режима
$badge = $mode === 'report' ? 'Отметка' : ($mode === 'region' ? 'Регион' : 'Сейчас');
imagettftext($img, 20, 0, 200, 120, $emerald, $fontB, mb_strtoupper($badge, 'UTF-8'));

// заголовок
imagettftext($img, 40, 0, 96, 300, $white, $fontB, $title);
// крупная строка статуса
imagettftext($img, 62, 0, 92, 400, $emerald, $fontB, $headline);
// подстрока
imagettftext($img, 34, 0, 96, 470, $muted, $fontR, $subline);

// privacy pill
$pillY = 540;
imagefilledrectangle($img, 96, $pillY, 96 + 470, $pillY + 52, imagecolorallocatealpha($img, 5, 150, 105, 110));
imagefilledellipse($img, 128, $pillY + 26, 12, 12, $emerald);
imagettftext($img, 22, 0, 150, $pillY + 35, $emerald, $fontR, 'Приватно · без регистрации');

// домен
imagettftext($img, 24, 0, 96, OG_H - 40, $muted, $fontR, 'kidai.website/whites');

header('Content-Type: image/png');
header('Cache-Control: public, max-age=600'); // 10 минут
imagepng($img);
imagedestroy($img);
