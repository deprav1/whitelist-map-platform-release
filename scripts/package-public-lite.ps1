[CmdletBinding()]
param(
    [string]$DataPath = "data\public-reports.sample.json",
    [string]$OutputZip = "tmp\whites-public-lite.zip"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$PublicLiteDir = Join-Path $RepoRoot "public-lite"
$ValidatorPath = Join-Path $ScriptDir "validate-public-data.ps1"
$SafetyAuditPath = Join-Path $ScriptDir "audit-public-data-safety.ps1"
$ModerationCasesCheckPath = Join-Path $ScriptDir "check-moderation-test-cases.ps1"
$StageName = "public-lite-package-{0}" -f ([System.Guid]::NewGuid().ToString("N"))
$StageDir = Join-Path $RepoRoot (Join-Path "tmp" $StageName)

if ([System.IO.Path]::IsPathRooted($OutputZip)) {
    throw "OutputZip must be relative to the repository root: $OutputZip"
}

$DataFullPath = Join-Path $RepoRoot $DataPath
$OutputPath = Join-Path $RepoRoot $OutputZip
$OutputDir = Split-Path -Parent $OutputPath

if (-not (Test-Path -LiteralPath $ValidatorPath)) {
    throw "Validator not found: $ValidatorPath"
}

if (-not (Test-Path -LiteralPath $SafetyAuditPath)) {
    throw "Safety audit not found: $SafetyAuditPath"
}

if (-not (Test-Path -LiteralPath $ModerationCasesCheckPath)) {
    throw "Moderation cases check not found: $ModerationCasesCheckPath"
}

if (-not (Test-Path -LiteralPath $PublicLiteDir)) {
    throw "public-lite directory not found: $PublicLiteDir"
}

foreach ($relativePath in @(
    ".htaccess",
    "api\context.php",
    "api\observations.php",
    "faq.html",
    "index.html",
    "privacy.html",
    "app.js",
    "styles.css",
    "reports.json",
    "reports.sample.json",
    "robots.txt",
    "rules.html",
    "sw.js",
    "submissions\.htaccess",
    "vendor\leaflet\leaflet.css",
    "vendor\leaflet\leaflet.js",
    "vendor\leaflet\images\marker-icon.png"
)) {
    $path = Join-Path $PublicLiteDir $relativePath
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required public-lite file not found: $path"
    }
}

Write-Host "Проверяю публичные данные: $DataFullPath"
& $ValidatorPath -Path $DataPath
& $SafetyAuditPath -Path $DataPath
& $ValidatorPath -Path "public-lite\reports.json"
& $SafetyAuditPath -Path "public-lite\reports.json"
& $ModerationCasesCheckPath

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot "tmp") | Out-Null
if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
}

$ResolvedTmp = (Resolve-Path (Join-Path $RepoRoot "tmp")).Path
if (Test-Path -LiteralPath $StageDir) {
    $ResolvedStage = (Resolve-Path $StageDir).Path
    if (-not $ResolvedStage.StartsWith($ResolvedTmp, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove staging directory outside tmp: $ResolvedStage"
    }
    Remove-Item -LiteralPath $StageDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $StageDir | Out-Null
Get-ChildItem -LiteralPath $PublicLiteDir -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $StageDir -Recurse -Force
}

$ArchiveItems = Get-ChildItem -LiteralPath $StageDir -Force | Select-Object -ExpandProperty FullName
Compress-Archive -LiteralPath $ArchiveItems -DestinationPath $OutputPath
Remove-Item -LiteralPath $StageDir -Recurse -Force

Write-Host ""
Write-Host "Архив готов: $OutputPath"
Write-Host ""
Write-Host "Следующие шаги для Timeweb без SSH:"
Write-Host "1. Откройте файловый менеджер и перейдите в public_html."
Write-Host "2. Удалите старые файлы статической карты, особенно index.htm/index.html и старые app/vendor-файлы."
Write-Host "3. Загрузите $([System.IO.Path]::GetFileName($OutputPath)) в public_html."
Write-Host "4. Распакуйте zip в public_html так, чтобы index.html лежал прямо в public_html, без дополнительной папки."
Write-Host "5. Проверьте, что есть public_html/vendor/leaflet/leaflet.css и leaflet.js."
Write-Host "6. Проверьте, что public_html/faq.html, public_html/rules.html и public_html/privacy.html доступны."
Write-Host "7. Проверьте, что public_html/sw.js перезаписан текущей версией offline-shell."
Write-Host "8. Проверьте, что public_html/api/context.php, public_html/api/observations.php и public_html/submissions/.htaccess тоже загрузились."
Write-Host "9. Убедитесь, что /submissions/observations-pending.jsonl не читается из браузера."
Write-Host "10. Откройте сайт и нажмите Ctrl+F5, чтобы обойти кеш браузера."
