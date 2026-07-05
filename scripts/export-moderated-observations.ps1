[CmdletBinding()]
param(
    [string]$PublicDataPath = "public-lite\reports.json",
    [string]$PendingPath = "public-lite\submissions\observations-pending.jsonl",
    [string]$DecisionsPath = "data\moderation-decisions.json",
    [string]$OutputPath = "public-lite\reports.json",
    [switch]$CreateTemplate,
    [switch]$DryRun
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$ValidatorPath = Join-Path $ScriptDir "validate-public-data.ps1"
$SafetyAuditPath = Join-Path $ScriptDir "audit-public-data-safety.ps1"

function Resolve-RepoPath([string]$Path) {
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }
    return Join-Path $RepoRoot $Path
}

function Read-JsonFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "JSON file not found: $Path"
    }
    return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
}

function Read-PendingObservations([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return @()
    }

    $items = @()
    $lineNumber = 0
    foreach ($line in [System.IO.File]::ReadLines($Path, [System.Text.Encoding]::UTF8)) {
        $lineNumber += 1
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }
        try {
            $items += ($line | ConvertFrom-Json)
        } catch {
            throw "Invalid JSONL at ${Path}:$lineNumber"
        }
    }
    return $items
}

function Has-Property($Object, [string]$Name) {
    return $null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name
}

function Get-PropertyValue($Object, [string]$Name, $Default = $null) {
    if (Has-Property $Object $Name) {
        return $Object.$Name
    }
    return $Default
}

function Set-PropertyValue($Object, [string]$Name, $Value) {
    if (Has-Property $Object $Name) {
        $Object.$Name = $Value
    } else {
        $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
    }
}

function Assert-NoPrivateData($Report) {
    $forbiddenFields = @(
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

    foreach ($field in $forbiddenFields) {
        if (Has-Property $Report $field) {
            throw "Public report $($Report.id) contains forbidden field: $field"
        }
    }

    $scan = @(
        $Report.region,
        $Report.city_or_area,
        $Report.operator,
        $Report.network_type,
        $Report.problem_type,
        $Report.confidence,
        $Report.summary
    ) + @($Report.checked_services)

    $text = ($scan | Where-Object { $null -ne $_ }) -join " "
    if ($text -match '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}') {
        throw "Public report $($Report.id) appears to contain an email-like value."
    }
    if ($text -match '\+?\d[\d\s\-\(\)]{7,}\d') {
        throw "Public report $($Report.id) appears to contain a phone-like value."
    }
    if ($text -match 'https?://|www\.|t\.me/|vk\.com/|instagram\.com/|facebook\.com/') {
        throw "Public report $($Report.id) appears to contain a public link."
    }
}

function Assert-PublicReportShape($Report) {
    $required = @(
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

    foreach ($field in $required) {
        if (-not (Has-Property $Report $field)) {
            throw "Public report is missing field: $field"
        }
    }

    if ((Get-PropertyValue $Report "status" "published") -ne "published") {
        throw "Public report $($Report.id) must have status: published"
    }

    Assert-NoPrivateData $Report
}

function New-PublicReportId {
    return "pub-{0}-{1}" -f (Get-Date -Format "yyyyMMddHHmmss"), ([System.Guid]::NewGuid().ToString("N").Substring(0, 8))
}

function Find-Report($Reports, [string]$Id) {
    foreach ($report in @($Reports)) {
        if ($report.id -eq $Id) {
            return $report
        }
    }
    return $null
}

function Increment-NumberProperty($Object, [string]$Name) {
    $current = 0
    if (Has-Property $Object $Name) {
        $current = [int](Get-PropertyValue $Object $Name 0)
    }
    Set-PropertyValue $Object $Name ($current + 1)
}

function Set-ExportManifest($PublicData, $Reports, [string]$Revision) {
    $manifest = [ordered]@{
        schema_version = "1.1"
        record_count = @($Reports).Count
        generated_at = (Get-Date).ToString("o")
        generated_from_moderation_revision = $Revision
    }
    Set-PropertyValue -Object $PublicData -Name "export_manifest" -Value $manifest
}

function Write-ModerationTemplate($Pending, [string]$Path) {
    $template = [ordered]@{
        generated_at = (Get-Date).ToString("o")
        instructions = "Copy this file to data\moderation-decisions.json, set decision for each observation, and remove raw details before committing."
        decisions = @(
            foreach ($item in @($Pending | Where-Object { $null -ne $_ })) {
                [ordered]@{
                    observation_id = [string](Get-PropertyValue $item "id" "unknown")
                    kind = [string](Get-PropertyValue $item "kind" "unknown")
                    decision = "ignore"
                    target_report_id = [string](Get-PropertyValue $item "source_report_id" "")
                    public_summary = ""
                    moderated_report = $null
                    public_patch = $null
                    review_hint = [ordered]@{
                        risk_level = Get-PropertyValue $item "risk_level" "normal"
                        risk_flags = Get-PropertyValue $item "risk_flags" @()
                        review_priority = Get-PropertyValue $item "review_priority" "normal"
                        source_report_id = Get-PropertyValue $item "source_report_id" ""
                        complaint_reason = Get-PropertyValue $item "complaint_reason" ""
                        city_or_area = Get-PropertyValue $item "city_or_area" ""
                        operator = Get-PropertyValue $item "operator" ""
                        network_type = Get-PropertyValue $item "network_type" ""
                        problem_type = Get-PropertyValue $item "problem_type" ""
                        checked_at = Get-PropertyValue $item "checked_at" ""
                        checked_services = Get-PropertyValue $item "checked_services" @()
                    }
                }
            }
        )
    }

    $dir = Split-Path -Parent $Path
    if ($dir) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $template | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$publicPath = Resolve-RepoPath $PublicDataPath
$pendingFullPath = Resolve-RepoPath $PendingPath
$decisionsFullPath = Resolve-RepoPath $DecisionsPath
$outputFullPath = Resolve-RepoPath $OutputPath

$pending = Read-PendingObservations $pendingFullPath

if ($CreateTemplate) {
    $templatePath = Resolve-RepoPath "tmp\moderation-decisions.template.json"
    Write-ModerationTemplate $pending $templatePath
    Write-Output "Moderation template written: $templatePath"
    return
}

$publicData = Read-JsonFile $publicPath
if (-not (Has-Property $publicData "reports")) {
    throw "Public data has no reports array: $publicPath"
}

$pendingById = @{}
foreach ($item in @($pending)) {
    if (Has-Property $item "id") {
        $pendingById[$item.id] = $item
    }
}

$reports = @()
foreach ($report in @($publicData.reports)) {
    Assert-PublicReportShape $report
    $reports += $report
}

if (-not (Test-Path -LiteralPath $decisionsFullPath)) {
    $pendingCount = @($pending).Count
    $message = "No moderation decisions file found: $decisionsFullPath. Nothing to apply. Pending observations: $pendingCount. Run with -CreateTemplate to prepare a review file."
    if ($DryRun) {
        Write-Output "Dry run OK. $message"
        Write-Output "Reports: $(@($reports).Count)."
        return
    }
    Write-Output $message
    Write-Output "No public data was written."
    return
}

$decisionsData = Read-JsonFile $decisionsFullPath
if (-not (Has-Property $decisionsData "decisions")) {
    throw "Decisions file must contain a decisions array: $decisionsFullPath"
}

$applied = 0
foreach ($decision in @($decisionsData.decisions)) {
    $observationId = [string](Get-PropertyValue $decision "observation_id" "")
    $action = [string](Get-PropertyValue $decision "decision" "ignore")
    if ($action -eq "ignore" -or $action -eq "reject") {
        continue
    }
    if (-not $pendingById.ContainsKey($observationId)) {
        throw "Decision references unknown observation: $observationId"
    }

    $observation = $pendingById[$observationId]
    switch ($action) {
        "merge_confirm" {
            $targetId = [string](Get-PropertyValue $decision "target_report_id" (Get-PropertyValue $observation "source_report_id" ""))
            $target = Find-Report $reports $targetId
            if ($null -eq $target) {
                throw "merge_confirm target not found: $targetId"
            }
            Increment-NumberProperty $target "confirmation_count"
            $applied += 1
        }
        "merge_restored" {
            $targetId = [string](Get-PropertyValue $decision "target_report_id" (Get-PropertyValue $observation "source_report_id" ""))
            $target = Find-Report $reports $targetId
            if ($null -eq $target) {
                throw "merge_restored target not found: $targetId"
            }
            Increment-NumberProperty $target "restoration_count"
            $restoredAt = [string](Get-PropertyValue $decision "last_restored_at" (Get-PropertyValue $observation "checked_at" (Get-Date).ToString("o")))
            Set-PropertyValue $target "last_restored_at" $restoredAt
            if ([bool](Get-PropertyValue $decision "mark_restored" $false)) {
                Set-PropertyValue $target "incident_category" "restored"
                Set-PropertyValue $target "problem_type" "Доступ восстановился"
                Set-PropertyValue $target "checked_at" $restoredAt
                $publicSummary = [string](Get-PropertyValue $decision "public_summary" "")
                if ($publicSummary.Trim()) {
                    Set-PropertyValue $target "summary" $publicSummary.Trim()
                }
            }
            Assert-PublicReportShape $target
            $applied += 1
        }
        "publish_report" {
            $moderatedReport = Get-PropertyValue $decision "moderated_report" $null
            if ($null -eq $moderatedReport) {
                throw "publish_report requires moderated_report for observation: $observationId"
            }
            if (-not (Has-Property $moderatedReport "id") -or [string]::IsNullOrWhiteSpace($moderatedReport.id)) {
                Set-PropertyValue $moderatedReport "id" (New-PublicReportId)
            }
            Set-PropertyValue $moderatedReport "status" "published"
            Assert-PublicReportShape $moderatedReport
            if ($null -ne (Find-Report $reports $moderatedReport.id)) {
                throw "Public report id already exists: $($moderatedReport.id)"
            }
            $reports += $moderatedReport
            $applied += 1
        }
        "hide_report" {
            $targetId = [string](Get-PropertyValue $decision "target_report_id" (Get-PropertyValue $observation "source_report_id" ""))
            $target = Find-Report $reports $targetId
            if ($null -eq $target) {
                throw "hide_report target not found: $targetId"
            }
            $reports = @($reports | Where-Object { $_.id -ne $targetId })
            $applied += 1
        }
        "edit_report" {
            $targetId = [string](Get-PropertyValue $decision "target_report_id" (Get-PropertyValue $observation "source_report_id" ""))
            $target = Find-Report $reports $targetId
            if ($null -eq $target) {
                throw "edit_report target not found: $targetId"
            }

            $patch = Get-PropertyValue $decision "public_patch" $null
            if ($null -eq $patch) {
                throw "edit_report requires public_patch for observation: $observationId"
            }

            $allowedPatchFields = @(
                "region",
                "city_or_area",
                "operator",
                "network_type",
                "problem_type",
                "incident_category",
                "checked_services",
                "checked_at",
                "confidence",
                "confirmation_count",
                "restoration_count",
                "last_restored_at",
                "freshness",
                "summary",
                "approx_location"
            )

            foreach ($field in $allowedPatchFields) {
                if (Has-Property $patch $field) {
                    Set-PropertyValue $target $field (Get-PropertyValue $patch $field)
                }
            }

            Set-PropertyValue $target "status" "published"
            Assert-PublicReportShape $target
            $applied += 1
        }
        default {
            throw "Unknown moderation decision: $action"
        }
    }
}

Set-PropertyValue -Object $publicData -Name "updated_at" -Value (Get-Date).ToString("o")
Set-PropertyValue -Object $publicData -Name "reports" -Value @($reports)
$revision = "moderation-decisions:{0}:{1}" -f ([System.IO.Path]::GetFileName($decisionsFullPath)), (Get-Date -Format "yyyyMMddHHmmss")
Set-ExportManifest -PublicData $publicData -Reports $reports -Revision $revision

$tmpDir = Join-Path $RepoRoot "tmp"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$auditPath = Join-Path $tmpDir ("moderated-public-data-{0}.json" -f ([System.Guid]::NewGuid().ToString("N")))
$publicData | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $auditPath -Encoding UTF8
try {
    if (-not (Test-Path -LiteralPath $ValidatorPath)) {
        throw "Validator not found: $ValidatorPath"
    }
    if (-not (Test-Path -LiteralPath $SafetyAuditPath)) {
        throw "Safety audit not found: $SafetyAuditPath"
    }
    & $ValidatorPath -Path $auditPath | Write-Output
    & $SafetyAuditPath -Path $auditPath | Write-Output
} catch {
    Remove-Item -LiteralPath $auditPath -Force -ErrorAction SilentlyContinue
    throw
}

if ($DryRun) {
    Remove-Item -LiteralPath $auditPath -Force -ErrorAction SilentlyContinue
    Write-Output "Dry run OK. Decisions applied: $applied. Reports: $(@($reports).Count)."
    return
}

$outputDir = Split-Path -Parent $outputFullPath
if ($outputDir) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Move-Item -LiteralPath $auditPath -Destination $outputFullPath -Force
Write-Output "Public data written: $outputFullPath"
Write-Output "Decisions applied: $applied. Reports: $(@($reports).Count)."
