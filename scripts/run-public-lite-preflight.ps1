[CmdletBinding()]
param(
    [switch]$IncludeLiveCheck,
    [switch]$IncludeBackup,
    [switch]$IncludeFutureSubdomainCheck,
    [switch]$CheckExtendedLivePages,
    [string]$ExpectedCacheName = "",
    [switch]$FailOnFutureSubdomainIssues
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

function Invoke-Step([string]$Name, [scriptblock]$Action) {
    Write-Host ""
    Write-Host "== $Name =="
    & $Action
}

Push-Location $RepoRoot
try {
    Invoke-Step "JavaScript syntax" {
        node --check public-lite\app.js
        node --check public-lite\sw.js
    }

    Invoke-Step "Public data validation" {
        .\scripts\validate-public-data.ps1 -Path public-lite\reports.json
        .\scripts\audit-public-data-safety.ps1 -Path public-lite\reports.json
        .\scripts\validate-public-data.ps1 -Path public-lite\reports.sample.json
        .\scripts\audit-public-data-safety.ps1 -Path public-lite\reports.sample.json
        .\scripts\validate-public-data.ps1 -Path data\public-reports.sample.json
        .\scripts\audit-public-data-safety.ps1 -Path data\public-reports.sample.json
    }

    Invoke-Step "Moderation fixtures" {
        .\scripts\check-moderation-test-cases.ps1
    }

    if ($IncludeLiveCheck) {
        Invoke-Step "Live read-only check" {
            $liveCheckArgs = @{}
            if ($IncludeFutureSubdomainCheck) {
                $liveCheckArgs.CheckFutureSubdomain = $true
            }
            if ($CheckExtendedLivePages) {
                $liveCheckArgs.CheckExtendedPages = $true
            }
            if ($ExpectedCacheName) {
                $liveCheckArgs.ExpectedCacheName = $ExpectedCacheName
            }
            if ($FailOnFutureSubdomainIssues) {
                $liveCheckArgs.FailOnFutureSubdomainIssues = $true
            }
            .\scripts\check-public-lite-live.ps1 @liveCheckArgs
        }
    }

    if ($IncludeBackup) {
        Invoke-Step "Live public reports backup" {
            .\scripts\backup-public-reports.ps1
        }
    }

    Invoke-Step "Package dry check" {
        $zip = "tmp\whites-public-lite-check-$([System.Guid]::NewGuid().ToString('N')).zip"
        .\scripts\package-public-lite.ps1 -OutputZip $zip
        $zipPath = (Resolve-Path -LiteralPath $zip).Path
        $tmpPath = (Resolve-Path -LiteralPath "tmp").Path
        if (-not $zipPath.StartsWith($tmpPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove archive outside tmp: $zipPath"
        }
        Remove-Item -LiteralPath $zipPath -Force
        Write-Host "Package check OK; transient archive removed: $zipPath"
    }

    Write-Host ""
    Write-Host "Public-lite preflight OK."
} finally {
    Pop-Location
}
