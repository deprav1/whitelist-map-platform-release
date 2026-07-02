[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,

    [string]$OutputZip = "tmp\whites-timeweb-shared.zip",
    [switch]$Force
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$BuildEnvPath = Join-Path $RepoRoot "build_env.sh"
$TarsDir = Join-Path $RepoRoot ".tars"
$WorkRoot = Join-Path $RepoRoot "tmp\timeweb-shared"
$PackageRoot = Join-Path $WorkRoot "package"
$PublicRoot = Join-Path $PackageRoot "public_html"
$DistDir = Join-Path $RepoRoot "dist"
$SiteUrl = $SiteUrl.TrimEnd("/")

function Get-BuildValue {
    param([Parameter(Mandatory = $true)][string]$Name)
    $line = Select-String -Path $BuildEnvPath -Pattern "^$Name=(.*)$" | Select-Object -First 1
    if (-not $line) {
        throw "Missing $Name in build_env.sh"
    }
    return $line.Matches[0].Groups[1].Value.Trim()
}

function Resolve-TemplateValue {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][hashtable]$Vars
    )
    $resolved = $Value
    foreach ($key in $Vars.Keys) {
        $resolved = $resolved.Replace('${' + $key + '}', $Vars[$key])
    }
    return $resolved
}

function Assert-SafeChildPath {
    param(
        [Parameter(Mandatory = $true)][string]$Parent,
        [Parameter(Mandatory = $true)][string]$Child
    )
    $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    $childFull = [System.IO.Path]::GetFullPath($Child)
    if (-not $childFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to operate outside ${parentFull}: $childFull"
    }
}

function Download-IfMissing {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Path
    )
    if (Test-Path -LiteralPath $Path) {
        Write-Host "Using cached tar: $Path"
        return
    }
    Write-Host "Downloading $Url"
    Invoke-WebRequest -Uri $Url -OutFile $Path
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$clientVersion = Get-BuildValue "client_version"
$apiVersion = Get-BuildValue "api_version"
$vars = @{
    client_version = $clientVersion
    api_version = $apiVersion
}

$clientTar = Resolve-TemplateValue (Get-BuildValue "client_tar") $vars
$apiTar = Resolve-TemplateValue (Get-BuildValue "api_tar") $vars
$clientUrl = Get-BuildValue "client_url"
$apiUrl = Get-BuildValue "api_url"

if ([string]::IsNullOrWhiteSpace($clientUrl)) {
    $clientUrl = "https://github.com/ushahidi/platform-client-mzima/releases/download/$clientVersion/$clientTar"
}
if ([string]::IsNullOrWhiteSpace($apiUrl)) {
    $apiUrl = "https://github.com/ushahidi/platform/releases/download/$apiVersion/$apiTar"
}

New-Item -ItemType Directory -Force -Path $TarsDir | Out-Null
Assert-SafeChildPath -Parent $RepoRoot -Child $WorkRoot
if (Test-Path -LiteralPath $WorkRoot) {
    if (-not $Force) {
        throw "Work directory exists: $WorkRoot. Re-run with -Force to rebuild it."
    }
    Remove-Item -LiteralPath $WorkRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $PublicRoot | Out-Null

$clientTarPath = Join-Path $TarsDir $clientTar
$apiTarPath = Join-Path $TarsDir $apiTar
Download-IfMissing -Url $clientUrl -Path $clientTarPath
Download-IfMissing -Url $apiUrl -Path $apiTarPath

$clientExtract = Join-Path $WorkRoot "client"
$apiExtract = Join-Path $WorkRoot "api"
New-Item -ItemType Directory -Force -Path $clientExtract, $apiExtract | Out-Null

tar -xzf $clientTarPath -C $clientExtract
if ($LASTEXITCODE -ne 0) {
    throw "Client tar extraction failed."
}
tar -xzf $apiTarPath -C $apiExtract
if ($LASTEXITCODE -ne 0) {
    throw "API tar extraction failed."
}

Copy-Item -Path (Join-Path $clientExtract "*") -Destination $PublicRoot -Recurse -Force
$apiBundle = Join-Path $apiExtract "ushahidi-platform-bundle-$apiVersion"
if (-not (Test-Path -LiteralPath $apiBundle)) {
    throw "API bundle was not found at $apiBundle"
}
Copy-Item -Path $apiBundle -Destination (Join-Path $PublicRoot "platform") -Recurse -Force

$envJson = @"
{
  "production": true,
  "backend_url": "/",
  "api_v3": "api/v3/",
  "api_v5": "api/v5/",
  "mapbox_api_key": "pk.eyJ1IjoidXNoYWhpZGkiLCJhIjoiY2lxaXUzeHBvMDdndmZ0bmVmOWoyMzN6NiJ9.CX56ZmZJv0aUsxvH5huJBw",
  "default_locale": "en_US",
  "oauth_client_id": "ushahidiui",
  "oauth_client_secret": "35e7f0bca957836d05ca0492211b0ac707671261",
  "export_polling_interval": 30000,
  "gtm_key": "",
  "intercom_appid": "",
  "sentry_dsn": "",
  "sentry_environment": "",
  "sentry_debug_mode": false
}
"@

$configJson = @"
{
  "client_id": "ushahidiui",
  "client_secret": "35e7f0bca957836d05ca0492211b0ac707671261",
  "backend_url": "$SiteUrl",
  "google_analytics_id": "",
  "intercom_app_id": "",
  "mapbox_api_key": "pk.eyJ1IjoidXNoYWhpZGkiLCJhIjoiY2lxaXUzeHBvMDdndmZ0bmVmOWoyMzN6NiJ9.CX56ZmZJv0aUsxvH5huJBw",
  "raven_url": ""
}
"@

Write-Utf8NoBom -Path (Join-Path $PublicRoot "env.json") -Content $envJson
Write-Utf8NoBom -Path (Join-Path $PublicRoot "config.json") -Content $configJson

Copy-Item -LiteralPath (Join-Path $DistDir "html-htaccess") -Destination (Join-Path $PublicRoot ".htaccess") -Force
Copy-Item -LiteralPath (Join-Path $DistDir "platform-htaccess") -Destination (Join-Path $PublicRoot "platform\.htaccess") -Force
Copy-Item -LiteralPath (Join-Path $DistDir "platform-httpdocs-htaccess") -Destination (Join-Path $PublicRoot "platform\httpdocs\.htaccess") -Force
New-Item -ItemType Directory -Force -Path (Join-Path $PublicRoot "platform\storage\app\public") | Out-Null
Copy-Item -LiteralPath (Join-Path $DistDir "platform-storage-app-public-htaccess") -Destination (Join-Path $PublicRoot "platform\storage\app\public\.htaccess") -Force

Copy-Item -LiteralPath (Join-Path $RepoRoot "deploy\timeweb\platform.env.example") -Destination (Join-Path $PublicRoot "platform\.env.timeweb.example") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "docs\TIMEWEB_DEPLOY.md") -Destination (Join-Path $PackageRoot "TIMEWEB_DEPLOY.md") -Force

$outputPath = Join-Path $RepoRoot $OutputZip
$outputDir = Split-Path -Parent $outputPath
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}
Compress-Archive -Path (Join-Path $PackageRoot "*") -DestinationPath $outputPath

Write-Host "Package created: $outputPath"
Write-Host "Upload the contents of public_html/ to the Timeweb site root."
