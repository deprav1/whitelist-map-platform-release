[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$HostName,

    [Parameter(Mandatory = $true)]
    [string]$UserName,

    [Parameter(Mandatory = $true)]
    [string]$RemotePublicHtml,

    [int]$Port = 22,

    [string]$KeyPath = "$env:USERPROFILE\.ssh\whites_timeweb_ed25519",

    [string]$PackagePath = "tmp\whites-public-lite.zip",

    [switch]$SkipStaleCleanup
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$Packager = Join-Path $ScriptDir "package-public-lite.ps1"

if (-not (Test-Path -LiteralPath $Packager)) {
    throw "Packager not found: $Packager"
}

if (-not (Test-Path -LiteralPath $KeyPath)) {
    throw "SSH private key not found: $KeyPath"
}

$PackageFullPath = Join-Path $RepoRoot $PackagePath
$Remote = "$UserName@$HostName"
$RemoteZip = "$RemotePublicHtml/whites-public-lite.zip"
$StaleRelativePaths = @(
    "admin",
    "icons",
    "api/_bootstrap.php",
    "api/complaint.php",
    "api/confirm.php",
    "api/health.php",
    "api/og.php",
    "api/submit.php",
    "manifest.json",
    "og-image.png",
    "og-image.svg",
    "share.php",
    "sitemap.xml"
)

Write-Host "Building package..."
& $Packager -OutputZip $PackagePath

if (-not (Test-Path -LiteralPath $PackageFullPath)) {
    throw "Package was not created: $PackageFullPath"
}

Write-Host ""
Write-Host "Checking remote directory..."
ssh -i $KeyPath -p $Port $Remote "mkdir -p '$RemotePublicHtml' && test -d '$RemotePublicHtml'"

if (-not $SkipStaleCleanup) {
    Write-Host ""
    Write-Host "Cleaning stale public-lite files..."
    $StalePathList = $StaleRelativePaths -join " "
    $CleanupCommand = @"
set -eu
cd '$RemotePublicHtml'
case "`$(pwd)" in
  '$RemotePublicHtml') ;;
  *) echo 'Unexpected remote cwd:' "`$(pwd)"; exit 1 ;;
esac
existing=""
for p in $StalePathList; do
  if [ -e "`$p" ]; then existing="`$existing `$p"; fi
done
if [ -n "`$existing" ]; then
  backup_dir="`$HOME/whites-stale-backups/`$(date +%Y%m%d-%H%M%S)-`$(basename '$RemotePublicHtml')"
  mkdir -p "`$backup_dir"
  tar -czf "`$backup_dir/stale-public-files.tar.gz" `$existing
  rm -rf `$existing
  echo "Cleaned stale files. Backup: `$backup_dir/stale-public-files.tar.gz"
else
  echo "No stale files found."
fi
"@
    ssh -i $KeyPath -p $Port $Remote $CleanupCommand
}

Write-Host ""
Write-Host "Uploading package to ${Remote}:$RemoteZip"
scp -i $KeyPath -P $Port $PackageFullPath "${Remote}:$RemoteZip"

Write-Host ""
Write-Host "Unpacking package..."
$RemoteCommand = @"
cd '$RemotePublicHtml' &&
unzip -o whites-public-lite.zip &&
rm -f whites-public-lite.zip &&
test -f index.html &&
test -f app.js &&
test -f styles.css &&
test -f reports.json &&
test -f .htaccess &&
test -f vendor/leaflet/leaflet.js &&
find . -maxdepth 3 -type f | sort | sed 's#^\./##' | head -80
"@

ssh -i $KeyPath -p $Port $Remote $RemoteCommand

Write-Host ""
Write-Host "Done. Open the site and press Ctrl+F5."
