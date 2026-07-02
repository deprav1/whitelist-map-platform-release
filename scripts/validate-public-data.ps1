[CmdletBinding()]
param(
    [string]$Path = "data\public-reports.sample.json"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$FullPath = Join-Path $RepoRoot $Path

if (-not (Test-Path -LiteralPath $FullPath)) {
    throw "Public data file not found: $FullPath"
}

$data = [System.IO.File]::ReadAllText($FullPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

foreach ($field in @("updated_at", "source", "disclaimer", "reports")) {
    if (-not ($data.PSObject.Properties.Name -contains $field)) {
        throw "Missing top-level field: $field"
    }
}

$allowedFreshness = @("now", "today", "recent", "stale")
$allowedCategories = @("internet-shutdown", "whitelist-only", "partial-connectivity", "restored", "needs-verification")
$requiredReportFields = @(
    "id",
    "region",
    "city_or_area",
    "operator",
    "network_type",
    "problem_type",
    "incident_category",
    "checked_services",
    "checked_at",
    "confidence",
    "freshness",
    "summary"
)

foreach ($report in @($data.reports)) {
    foreach ($field in $requiredReportFields) {
        if (-not ($report.PSObject.Properties.Name -contains $field)) {
            throw "Report $($report.id) missing field: $field"
        }
    }

    if ($allowedFreshness -notcontains $report.freshness) {
        throw "Report $($report.id) has invalid freshness: $($report.freshness)"
    }

    if ($allowedCategories -notcontains $report.incident_category) {
        throw "Report $($report.id) has invalid category: $($report.incident_category)"
    }

    if ($report.summary -match '\+?\d[\d\s\-\(\)]{7,}\d') {
        throw "Report $($report.id) summary appears to contain a phone-like value."
    }

    if ($report.summary -match '@') {
        throw "Report $($report.id) summary appears to contain an email-like value."
    }
}

Write-Output "Public data OK: $FullPath"
