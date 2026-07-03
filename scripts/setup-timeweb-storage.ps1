param(
  [string]$HostName = "vh464.timeweb.ru",
  [string]$UserName = "cb077728",
  [int]$Port = 22,
  [string]$KeyPath = "$env:USERPROFILE\.ssh\whites_timeweb_ed25519",
  [string]$RemoteDataDir = "/home/c/cb077728/KidAI/whites-data",
  [string]$HealthUrl = "https://kidai.website/whites/api/health.php",
  [switch]$EnsureAdminToken
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}

$sshTarget = "$UserName@$HostName"
$remoteCommand = "mkdir -p '$RemoteDataDir' && chmod 700 '$RemoteDataDir' && ls -ld '$RemoteDataDir'"

Write-Host "Preparing private WhiteS storage on $sshTarget..."
ssh -i $KeyPath -p $Port $sshTarget $remoteCommand

if ($EnsureAdminToken) {
  $tokenCommand = @"
set -e
mkdir -p '$RemoteDataDir'
chmod 700 '$RemoteDataDir'
if [ ! -s '$RemoteDataDir/admin-token.txt' ]; then
  php -r 'echo bin2hex(random_bytes(24)), PHP_EOL;' > '$RemoteDataDir/admin-token.txt'
  chmod 600 '$RemoteDataDir/admin-token.txt'
  echo 'Admin token created: $RemoteDataDir/admin-token.txt'
else
  chmod 600 '$RemoteDataDir/admin-token.txt'
  echo 'Admin token already exists: $RemoteDataDir/admin-token.txt'
fi
"@
  Write-Host "Preparing private admin token..."
  ssh -i $KeyPath -p $Port $sshTarget $tokenCommand
}

if ($HealthUrl) {
  Write-Host "Checking API health: $HealthUrl"
  $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -Headers @{"Cache-Control" = "no-cache"}
  Write-Host $response.Content
}
