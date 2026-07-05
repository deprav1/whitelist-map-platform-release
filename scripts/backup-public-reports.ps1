[CmdletBinding()]
param(
    [string]$BaseUrl = "https://kidai.website/whites/",
    [string]$OutputDir = "backups\public-lite"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$ValidatorPath = Join-Path $ScriptDir "validate-public-data.ps1"
$SafetyAuditPath = Join-Path $ScriptDir "audit-public-data-safety.ps1"
$TmpDir = Join-Path $RepoRoot "tmp"

function Get-BaseUri([string]$Url) {
    if (-not $Url.EndsWith("/")) {
        $Url = "$Url/"
    }
    return [uri]$Url
}

if (-not (Test-Path -LiteralPath $ValidatorPath)) {
    throw "Validator not found: $ValidatorPath"
}
if (-not (Test-Path -LiteralPath $SafetyAuditPath)) {
    throw "Safety audit not found: $SafetyAuditPath"
}

if ([System.IO.Path]::IsPathRooted($OutputDir)) {
    $outputFullPath = $OutputDir
} else {
    $outputFullPath = Join-Path $RepoRoot $OutputDir
}

New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $outputFullPath | Out-Null

$baseUri = Get-BaseUri $BaseUrl
$reportsUrl = ([uri]::new($baseUri, "reports.json")).AbsoluteUri
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tmpPath = Join-Path $TmpDir ("reports-backup-check-{0}.json" -f ([System.Guid]::NewGuid().ToString("N")))
$backupPath = Join-Path $outputFullPath ("reports-{0}.json" -f $timestamp)

if (Test-Path -LiteralPath $backupPath) {
    throw "Backup file already exists: $backupPath"
}

try {
    Write-Host "Downloading public reports: $reportsUrl"
    $response = Invoke-WebRequest -Uri $reportsUrl -UseBasicParsing -Headers @{"Cache-Control" = "no-cache"} -TimeoutSec 20 -ErrorAction Stop
    if ([int]$response.StatusCode -ne 200) {
        throw "Expected HTTP 200 from $reportsUrl, got HTTP $($response.StatusCode)."
    }

    [System.IO.File]::WriteAllText($tmpPath, $response.Content, [System.Text.UTF8Encoding]::new($false))
    & $ValidatorPath -Path $tmpPath
    & $SafetyAuditPath -Path $tmpPath

    $data = $response.Content | ConvertFrom-Json
    $reportCount = @($data.reports).Count

    Copy-Item -LiteralPath $tmpPath -Destination $backupPath
    Write-Host ("Backup saved: {0}" -f $backupPath)
    Write-Host ("Backup reports: {0} report(s), updated_at={1}, source={2}" -f $reportCount, $data.updated_at, $data.source)
} finally {
    if (Test-Path -LiteralPath $tmpPath) {
        $resolvedTmp = (Resolve-Path -LiteralPath $TmpDir).Path
        $resolvedTempFile = (Resolve-Path -LiteralPath $tmpPath).Path
        if (-not $resolvedTempFile.StartsWith($resolvedTmp, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove temp file outside tmp: $resolvedTempFile"
        }
        Remove-Item -LiteralPath $resolvedTempFile -Force
    }
}
