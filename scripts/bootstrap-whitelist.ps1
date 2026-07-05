[CmdletBinding()]
param(
    [string]$BaseUrl = $(if ($env:USH_BASE_URL) { $env:USH_BASE_URL } else { "http://localhost:8080" }),
    [string]$AdminEmail = $(if ($env:USH_ADMIN_EMAIL) { $env:USH_ADMIN_EMAIL } else { "admin@example.com" }),
    [string]$AdminPassword = $(if ($env:USH_ADMIN_PASSWORD) { $env:USH_ADMIN_PASSWORD } else { "admin" }),
    [string]$ClientId = $(if ($env:USH_OAUTH_CLIENT_ID) { $env:USH_OAUTH_CLIENT_ID } else { "ushahidiui" }),
    [string]$ClientSecret = $(if ($env:USH_OAUTH_CLIENT_SECRET) { $env:USH_OAUTH_CLIENT_SECRET } else { "35e7f0bca957836d05ca0492211b0ac707671261" }),
    [int]$RetrySeconds = 90,
    [switch]$DryRun
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$BaseUrl = $BaseUrl.TrimEnd("/")
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$SurveyPath = Join-Path $RepoRoot "config\whitelist-survey.v5.json"
$CategoriesPath = Join-Path $RepoRoot "config\whitelist-categories.v5.json"

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing JSON config: $Path"
    }
    [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
}

function ConvertTo-JsonPayload {
    param([Parameter(Mandatory = $true)]$Value)
    $Value | ConvertTo-Json -Depth 64
}

function Get-ResponseBody {
    param([Parameter(Mandatory = $true)]$ErrorRecord)
    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) {
        return $ErrorRecord.Exception.Message
    }

    $stream = $response.GetResponseStream()
    if ($null -eq $stream) {
        return $ErrorRecord.Exception.Message
    }

    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($body)) {
        return $ErrorRecord.Exception.Message
    }
    return $body
}

function Connect-Ushahidi {
    $scope = "posts country_codes media forms api tags savedsearches sets users stats layers config messages notifications webhooks contacts roles permissions csv tos dataproviders migrate apikeys"
    $deadline = (Get-Date).AddSeconds($RetrySeconds)

    do {
        try {
            Write-Host "Connecting to $BaseUrl as $AdminEmail..."
            $token = Invoke-RestMethod `
                -Method Post `
                -Uri "$BaseUrl/oauth/token" `
                -ContentType "application/x-www-form-urlencoded" `
                -Body @{
                    username = $AdminEmail
                    password = $AdminPassword
                    grant_type = "password"
                    client_id = $ClientId
                    client_secret = $ClientSecret
                    scope = $scope
                }
            return $token
        }
        catch {
            if ((Get-Date) -ge $deadline) {
                $body = Get-ResponseBody -ErrorRecord $_
                throw "Could not authenticate with Ushahidi at $BaseUrl. Last response: $body"
            }
            Start-Sleep -Seconds 3
        }
    } while ($true)
}

function Invoke-UshahidiApi {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("GET", "POST", "PUT", "PATCH", "DELETE")][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        $Body = $null
    )

    $params = @{
        Method = $Method
        Uri = "$BaseUrl$Path"
        Headers = $Script:AuthHeaders
    }

    if ($null -ne $Body) {
        $params["ContentType"] = "application/json; charset=utf-8"
        $params["Body"] = ConvertTo-JsonPayload -Value $Body
    }

    try {
        Invoke-RestMethod @params
    }
    catch {
        $responseBody = Get-ResponseBody -ErrorRecord $_
        throw "$Method $Path failed: $responseBody"
    }
}

function Flatten-Categories {
    param($Items)
    foreach ($item in @($Items)) {
        $item
        if (($item.PSObject.Properties.Name -contains "children") -and $item.children) {
            Flatten-Categories -Items $item.children
        }
    }
}

function Get-ExistingCategories {
    $response = Invoke-UshahidiApi -Method GET -Path "/api/v5/categories?only=id,tag,slug,type"
    if ($null -eq $response.results) {
        return @()
    }
    @(Flatten-Categories -Items $response.results)
}

function Ensure-Categories {
    param([Parameter(Mandatory = $true)]$DesiredCategories)

    $existing = Get-ExistingCategories
    $categoryIdsBySlug = @{}

    foreach ($category in @($DesiredCategories)) {
        $match = $existing | Where-Object { $_.slug -eq $category.slug } | Select-Object -First 1
        if ($match) {
            Write-Host "Category exists: $($category.slug) (#$($match.id))"
            $categoryIdsBySlug[$category.slug] = [string]$match.id
            continue
        }

        Write-Host "Creating category: $($category.slug)"
        $created = Invoke-UshahidiApi -Method POST -Path "/api/v5/categories" -Body $category
        if ($created.result) {
            Write-Host "Created category #$($created.result.id): $($created.result.slug)"
            $categoryIdsBySlug[$category.slug] = [string]$created.result.id
        }
    }

    return $categoryIdsBySlug
}

function Add-CategoryFieldToSurvey {
    param(
        [Parameter(Mandatory = $true)]$Survey,
        [Parameter(Mandatory = $true)]$CategoryIdsBySlug
    )

    $categoryIds = @(
        "internet-shutdown",
        "whitelist-only",
        "partial-connectivity",
        "restored",
        "needs-verification"
    ) | ForEach-Object {
        if ($CategoryIdsBySlug.ContainsKey($_)) {
            $CategoryIdsBySlug[$_]
        }
    }

    if (-not $categoryIds -or $categoryIds.Count -eq 0) {
        Write-Host "No category ids available; survey category tag field was not added."
        return
    }

    $targetTask = @($Survey.tasks) | Where-Object { $_.label -eq "Connectivity check" } | Select-Object -First 1
    if ($null -eq $targetTask) {
        Write-Host "Connectivity check task was not found; survey category tag field was not added."
        return
    }

    $fields = @($targetTask.fields)
    $existingField = $fields | Where-Object { $_.key -eq "incident_category" } | Select-Object -First 1
    if ($existingField) {
        $existingField.options = @($categoryIds)
        return
    }

    Write-Host "incident_category field was not found; category tag options were not attached."
}

function Ensure-Survey {
    param([Parameter(Mandatory = $true)]$Survey)

    $existingResponse = Invoke-UshahidiApi -Method GET -Path "/api/v5/surveys?only=id,name"
    $existing = @($existingResponse.results) | Where-Object { $_.name -eq $Survey.name } | Select-Object -First 1

    if ($existing) {
        Write-Host "Survey exists: $($Survey.name) (#$($existing.id))"
        Write-Host "No update was applied to avoid overwriting manual admin changes."
        return
    }

    Write-Host "Creating survey: $($Survey.name)"
    $created = Invoke-UshahidiApi -Method POST -Path "/api/v5/surveys" -Body $Survey
    if ($created.result) {
        Write-Host "Created survey #$($created.result.id): $($created.result.name)"
    }
    else {
        Write-Host "Survey create request completed."
    }
}

$categories = Read-JsonFile -Path $CategoriesPath
$survey = Read-JsonFile -Path $SurveyPath

if ($DryRun) {
    $dryRunCategoryIds = @{}
    $i = 1
    foreach ($category in @($categories)) {
        $dryRunCategoryIds[$category.slug] = [string]$i
        $i++
    }
    Add-CategoryFieldToSurvey -Survey $survey -CategoryIdsBySlug $dryRunCategoryIds

    Write-Host "Dry run only. No calls will be sent to Ushahidi."
    Write-Host "Base URL: $BaseUrl"
    Write-Host ""
    Write-Host "Categories payload:"
    ConvertTo-JsonPayload -Value $categories
    Write-Host ""
    Write-Host "Survey payload:"
    ConvertTo-JsonPayload -Value $survey
    exit 0
}

$token = Connect-Ushahidi
$Script:AuthHeaders = @{
    Authorization = "$($token.token_type) $($token.access_token)"
}

$categoryIdsBySlug = Ensure-Categories -DesiredCategories $categories
Add-CategoryFieldToSurvey -Survey $survey -CategoryIdsBySlug $categoryIdsBySlug
Ensure-Survey -Survey $survey

Write-Host "Где белые списки? bootstrap completed. New public reports will require moderation before publishing."
