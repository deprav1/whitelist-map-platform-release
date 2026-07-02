[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[a-z0-9][a-z0-9-]{2,40}$")]
    [string]$AppName,

    [ValidatePattern("^[a-z0-9][a-z0-9-]{2,40}$")]
    [string]$DbAppName = "",

    [string]$Region = "fra",
    [string]$Org = "",
    [string]$ExternalMysqlHost = "",
    [string]$ExternalMysqlPort = "3306",
    [string]$ExternalMysqlDatabase = "ushahidi",
    [string]$ExternalMysqlUser = "ushahidi",
    [string]$ExternalMysqlPassword = "",
    [switch]$SkipDatabaseDeploy
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DbAppName)) {
    $DbAppName = "$AppName-db"
}

$UseExternalMysql = -not [string]::IsNullOrWhiteSpace($ExternalMysqlHost)
if ($UseExternalMysql -and [string]::IsNullOrWhiteSpace($ExternalMysqlPassword)) {
    throw "ExternalMysqlPassword is required when ExternalMysqlHost is set."
}

$fly = Get-Command flyctl -ErrorAction SilentlyContinue
if (-not $fly) {
    throw "flyctl is not installed. Install it from https://fly.io/docs/flyctl/install/ and run 'flyctl auth login' first."
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$DeployDir = Join-Path $RepoRoot "deploy\fly"
$GeneratedDir = Join-Path $RepoRoot "tmp\fly"
New-Item -ItemType Directory -Force -Path $GeneratedDir | Out-Null

function New-Secret {
    param([int]$Bytes = 24)
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    [Convert]::ToBase64String($buffer).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Write-Template {
    param(
        [Parameter(Mandatory = $true)][string]$TemplatePath,
        [Parameter(Mandatory = $true)][string]$OutPath,
        [Parameter(Mandatory = $true)][hashtable]$Values
    )

    $content = [System.IO.File]::ReadAllText($TemplatePath, [System.Text.Encoding]::UTF8)
    foreach ($key in $Values.Keys) {
        $content = $content.Replace($key, $Values[$key])
    }
    [System.IO.File]::WriteAllText($OutPath, $content, [System.Text.Encoding]::UTF8)
}

function Invoke-Fly {
    param(
        [switch]$Redact,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$FlyArgs
    )

    $displayArgs = @($FlyArgs)
    if ($Redact) {
        $displayArgs = $displayArgs | ForEach-Object {
            if ($_ -match "=") {
                $name = $_.Split("=", 2)[0]
                "$name=<redacted>"
            }
            else {
                $_
            }
        }
    }

    Write-Host "flyctl $($displayArgs -join ' ')"
    & flyctl @FlyArgs
    if ($LASTEXITCODE -ne 0) {
        throw "flyctl command failed with exit code $LASTEXITCODE"
    }
}

$appToml = Join-Path $GeneratedDir "$AppName.fly.toml"
$dbToml = Join-Path $GeneratedDir "$DbAppName.fly.toml"

Write-Template `
    -TemplatePath (Join-Path $DeployDir "fly.toml.example") `
    -OutPath $appToml `
    -Values @{
        "REPLACE_WITH_FLY_APP" = $AppName
        'primary_region = "fra"' = "primary_region = `"$Region`""
    }

Write-Template `
    -TemplatePath (Join-Path $DeployDir "mysql.fly.toml.example") `
    -OutPath $dbToml `
    -Values @{
        "REPLACE_WITH_FLY_DB_APP" = $DbAppName
        'primary_region = "fra"' = "primary_region = `"$Region`""
    }

$mysqlPassword = New-Secret
$mysqlRootPassword = New-Secret
$appKey = New-Secret -Bytes 32
$orgArgs = @()
if (-not [string]::IsNullOrWhiteSpace($Org)) {
    $orgArgs = @("--org", $Org)
}

if ($UseExternalMysql) {
    Write-Host "Using external MySQL host: $ExternalMysqlHost"
}
elseif (-not $SkipDatabaseDeploy) {
    Invoke-Fly apps create $DbAppName @orgArgs
    Invoke-Fly volumes create mysql_data --app $DbAppName --region $Region --size 1 --yes
    Invoke-Fly -Redact secrets set --app $DbAppName "MYSQL_ROOT_PASSWORD=$mysqlRootPassword" "MYSQL_PASSWORD=$mysqlPassword"
    Invoke-Fly deploy --config $dbToml --app $DbAppName
}

Invoke-Fly apps create $AppName @orgArgs
Invoke-Fly volumes create ushahidi_storage --app $AppName --region $Region --size 1 --yes

if ($UseExternalMysql) {
    $appMysqlHost = $ExternalMysqlHost
    $appMysqlPort = $ExternalMysqlPort
    $appMysqlDatabase = $ExternalMysqlDatabase
    $appMysqlUser = $ExternalMysqlUser
    $appMysqlPassword = $ExternalMysqlPassword
}
else {
    $appMysqlHost = "$DbAppName.internal"
    $appMysqlPort = "3306"
    $appMysqlDatabase = "ushahidi"
    $appMysqlUser = "ushahidi"
    $appMysqlPassword = $mysqlPassword
}

Invoke-Fly -Redact secrets set --app $AppName `
    "APP_KEY=$appKey" `
    "SITE_URL=https://$AppName.fly.dev" `
    "MYSQL_HOST=$appMysqlHost" `
    "MYSQL_PORT=$appMysqlPort" `
    "MYSQL_DATABASE=$appMysqlDatabase" `
    "MYSQL_USER=$appMysqlUser" `
    "MYSQL_PASSWORD=$appMysqlPassword"
Invoke-Fly deploy --config $appToml --app $AppName

Write-Host ""
Write-Host "Deploy requested."
Write-Host "Public URL: https://$AppName.fly.dev"
Write-Host ""
Write-Host "After the app opens, seed WhiteS categories and the report form:"
Write-Host "`$env:USH_BASE_URL='https://$AppName.fly.dev'"
Write-Host ".\scripts\bootstrap-whitelist.ps1"
Write-Host ""
Write-Host "Immediately change the default Ushahidi admin password after first login."
