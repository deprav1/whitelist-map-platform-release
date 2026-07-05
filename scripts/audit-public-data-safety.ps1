[CmdletBinding()]
param(
    [string]$Path = "public-lite\reports.json"
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

function Has-Property($Object, [string]$Name) {
    return $null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name
}

function Add-Finding([System.Collections.Generic.List[string]]$Findings, [string]$ReportId, [string]$Message) {
    $Findings.Add("Report ${ReportId}: $Message")
}

function Get-ScanText($Report) {
    $parts = @(
        $Report.region,
        $Report.city_or_area,
        $Report.operator,
        $Report.network_type,
        $Report.problem_type,
        $Report.confidence,
        $Report.summary
    ) + @($Report.checked_services)

    return ($parts | Where-Object { $null -ne $_ }) -join " "
}

$data = [System.IO.File]::ReadAllText($FullPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
if (-not (Has-Property $data "reports")) {
    throw "Public data has no reports array: $FullPath"
}

$findings = [System.Collections.Generic.List[string]]::new()
$forbiddenFields = @(
    "author_id",
    "username",
    "email",
    "phone",
    "ip",
    "ip_address",
    "user_agent",
    "source_hash",
    "risk_level",
    "risk_flags",
    "review_priority",
    "moderator_note",
    "raw_comment",
    "private_note",
    "admin_url",
    "access_token",
    "source_url",
    "attachments"
)
$allowedPrecision = @("district", "city", "region")

foreach ($report in @($data.reports)) {
    $reportId = if (Has-Property $report "id") { [string]$report.id } else { "<missing-id>" }

    foreach ($field in $forbiddenFields) {
        if (Has-Property $report $field) {
            Add-Finding $findings $reportId "contains forbidden public field '$field'."
        }
    }

    $text = Get-ScanText $report
    if ($text -match '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}') {
        Add-Finding $findings $reportId "appears to contain an email-like value."
    }
    if ($text -match '\+?\d[\d\s\-\(\)]{7,}\d') {
        Add-Finding $findings $reportId "appears to contain a phone-like value."
    }
    if ($text -match '\b(?:\d{1,3}\.){3}\d{1,3}\b') {
        Add-Finding $findings $reportId "appears to contain an IP address."
    }
    if ($text -match '\b\d{1,2}[\.,]\d{4,}\s*[,; ]\s*\d{1,3}[\.,]\d{4,}\b') {
        Add-Finding $findings $reportId "appears to contain precise coordinates in text."
    }
    if ($text -match 'https?://|www\.|t\.me/|vk\.com/|instagram\.com/|facebook\.com/') {
        Add-Finding $findings $reportId "appears to contain a public or private link."
    }
    if ($text -match '\b(ул\.?|улица|проспект|пр-т|дом|д\.|квартира|кв\.|подъезд|этаж)\b') {
        Add-Finding $findings $reportId "appears to contain exact-address wording."
    }
    if ($text -match '\b(vpn|proxy|прокси|wireguard|openvpn|outline|ключ|конфиг|config|wg://|ss://|vless://|trojan://)\b') {
        Add-Finding $findings $reportId "appears to contain VPN/proxy instructions or keys."
    }
    if ($text -match '\b(user-agent|mozilla/5\.0|curl/|okhttp|python-requests)\b') {
        Add-Finding $findings $reportId "appears to contain user-agent-like technical metadata."
    }

    if (Has-Property $report "approx_location" -and $null -ne $report.approx_location) {
        $precision = if (Has-Property $report.approx_location "precision") { [string]$report.approx_location.precision } else { "" }
        if ($allowedPrecision -notcontains $precision) {
            Add-Finding $findings $reportId "has unsafe or missing approx_location.precision '$precision'."
        }
    }
}

if ($findings.Count -gt 0) {
    $message = "Public data safety audit failed:`n" + (($findings | ForEach-Object { "- $_" }) -join "`n")
    throw $message
}

Write-Output "Public data safety audit OK: $FullPath"
