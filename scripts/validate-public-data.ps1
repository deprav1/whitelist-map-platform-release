[CmdletBinding()]
param(
    [string]$Path = "data\public-reports.sample.json"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if ([System.IO.Path]::IsPathRooted($Path)) {
    $FullPath = $Path
} else {
    $FullPath = Join-Path $RepoRoot $Path
}

if (-not (Test-Path -LiteralPath $FullPath)) {
    throw "Public data file not found: $FullPath"
}

$data = [System.IO.File]::ReadAllText($FullPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

foreach ($field in @("updated_at", "source", "disclaimer", "reports")) {
    if (-not ($data.PSObject.Properties.Name -contains $field)) {
        throw "Missing top-level field: $field"
    }
}

$reports = @($data.reports)
if ($data.PSObject.Properties.Name -contains "export_manifest") {
    $manifest = $data.export_manifest
    foreach ($field in @("schema_version", "record_count", "generated_at", "generated_from_moderation_revision")) {
        if (-not ($manifest.PSObject.Properties.Name -contains $field)) {
            throw "Missing export_manifest field: $field"
        }
    }

    if ([string]::IsNullOrWhiteSpace([string]$manifest.schema_version)) {
        throw "export_manifest.schema_version must not be empty"
    }
    if ([string]::IsNullOrWhiteSpace([string]$manifest.generated_from_moderation_revision)) {
        throw "export_manifest.generated_from_moderation_revision must not be empty"
    }

    $generatedAt = [datetimeoffset]::MinValue
    if (-not [datetimeoffset]::TryParse([string]$manifest.generated_at, [ref]$generatedAt)) {
        throw "export_manifest.generated_at is not a valid datetime: $($manifest.generated_at)"
    }

    $recordCount = [int]$manifest.record_count
    if ($recordCount -ne $reports.Count) {
        throw "export_manifest.record_count ($recordCount) does not match reports count ($($reports.Count))"
    }
}

$allowedFreshness = @("now", "today", "recent", "stale")
$allowedCategories = @("internet-shutdown", "whitelist-only", "partial-connectivity", "restored", "needs-verification")
$forbiddenPublicFields = @(
    "author_id",
    "username",
    "email",
    "phone",
    "ip",
    "ip_address",
    "user_agent",
    "source_hash",
    "moderator_note",
    "raw_comment",
    "private_note",
    "admin_url",
    "access_token"
)
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

foreach ($report in $reports) {
    foreach ($field in $forbiddenPublicFields) {
        if ($report.PSObject.Properties.Name -contains $field) {
            throw "Report $($report.id) contains forbidden public field: $field"
        }
    }

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

    if ($report.summary -match 'https?://|www\.|t\.me/|vk\.com/|instagram\.com/|facebook\.com/') {
        throw "Report $($report.id) summary appears to contain a public link."
    }

    if ($report.PSObject.Properties.Name -contains "restoration_count") {
        $restorationCount = [int]$report.restoration_count
        if ($restorationCount -lt 0) {
            throw "Report $($report.id) has invalid restoration_count: $($report.restoration_count)"
        }
    }

    if ($report.PSObject.Properties.Name -contains "last_restored_at") {
        $parsedRestoredAt = [datetimeoffset]::MinValue
        if (-not [datetimeoffset]::TryParse([string]$report.last_restored_at, [ref]$parsedRestoredAt)) {
            throw "Report $($report.id) has invalid last_restored_at: $($report.last_restored_at)"
        }
    }
}

Write-Output "Public data OK: $FullPath"
