param(
  [string]$Path = "data/moderation-test-cases.json",
  [int]$MinCases = 20
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Path)) {
  throw "Moderation test cases file not found: $Path"
}

$raw = Get-Content -LiteralPath $Path -Raw
$data = $raw | ConvertFrom-Json

if (-not $data.cases -or $data.cases.Count -lt $MinCases) {
  throw "Expected at least $MinCases moderation cases."
}

$allowedKinds = @("problem", "confirm", "restored", "complaint")
$allowedDecisions = @(
  "publish_report",
  "merge_confirm",
  "merge_restored",
  "hide_report",
  "edit_report",
  "reject",
  "ignore",
  "needs_more_context"
)
$allowedPriorities = @("normal", "first")
$allowedFlags = @(
  "personal_data",
  "email",
  "phone",
  "ip_address",
  "precise_coordinates",
  "url",
  "exact_address_marker",
  "exact_location",
  "dangerous",
  "vpn_proxy_or_key",
  "user_agent_like",
  "spam",
  "duplicate",
  "conflicting_status",
  "outdated",
  "wrong_category"
)

$ids = New-Object System.Collections.Generic.HashSet[string]
$hasFirstPriority = $false
$hasSafePublish = $false
$hasComplaint = $false

foreach ($case in $data.cases) {
  foreach ($field in @("id", "kind", "summary", "expected_decision", "expected_priority", "expected_risk_flags")) {
    if (-not $case.PSObject.Properties.Name.Contains($field)) {
      throw "Case is missing required field '$field'."
    }
  }

  if (-not $ids.Add([string]$case.id)) {
    throw "Duplicate moderation case id: $($case.id)"
  }
  if ($allowedKinds -notcontains $case.kind) {
    throw "Case $($case.id) has unknown kind: $($case.kind)"
  }
  if ($allowedDecisions -notcontains $case.expected_decision) {
    throw "Case $($case.id) has unknown expected_decision: $($case.expected_decision)"
  }
  if ($allowedPriorities -notcontains $case.expected_priority) {
    throw "Case $($case.id) has unknown expected_priority: $($case.expected_priority)"
  }

  foreach ($flag in @($case.expected_risk_flags)) {
    if ($allowedFlags -notcontains $flag) {
      throw "Case $($case.id) has unknown risk flag: $flag"
    }
  }

  if ($case.expected_priority -eq "first") { $hasFirstPriority = $true }
  if ($case.expected_decision -eq "publish_report") { $hasSafePublish = $true }
  if ($case.kind -eq "complaint") { $hasComplaint = $true }
}

if (-not $hasFirstPriority) {
  throw "Expected at least one first-priority moderation case."
}
if (-not $hasSafePublish) {
  throw "Expected at least one safe publish_report case."
}
if (-not $hasComplaint) {
  throw "Expected at least one complaint case."
}

Write-Host "OK: $($data.cases.Count) moderation test cases validated."
