param(
  [string]$HostName = "vh464.timeweb.ru",
  [string]$UserName = "cb077728",
  [int]$Port = 22,
  [string]$KeyPath = "$env:USERPROFILE\.ssh\whites_timeweb_ed25519",
  [string]$RemoteDataDir = "/home/c/cb077728/KidAI/whites-data",
  [string]$HealthUrl = "https://kidai.website/whites/api/health.php"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}

$sshTarget = "$UserName@$HostName"
$remoteCommand = "mkdir -p '$RemoteDataDir' && chmod 700 '$RemoteDataDir' && ls -ld '$RemoteDataDir'"

Write-Host "Preparing private WhiteS storage on $sshTarget..."
ssh -i $KeyPath -p $Port $sshTarget $remoteCommand

if ($HealthUrl) {
  Write-Host "Checking API health: $HealthUrl"
  $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -Headers @{"Cache-Control" = "no-cache"}
  Write-Host $response.Content
}
