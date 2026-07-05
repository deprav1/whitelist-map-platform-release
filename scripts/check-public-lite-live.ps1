[CmdletBinding()]
param(
    [string]$BaseUrl = "https://kidai.website/whites/",
    [switch]$CheckFutureSubdomain,
    [string]$FutureHost = "whites.kidai.website",
    [int]$CertificateWarnDays = 14,
    [int]$RequestRetries = 1,
    [switch]$CheckExtendedPages,
    [string]$ExpectedCacheName = "",
    [switch]$FailOnFutureSubdomainIssues
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$ValidatorPath = Join-Path $ScriptDir "validate-public-data.ps1"
$SafetyAuditPath = Join-Path $ScriptDir "audit-public-data-safety.ps1"
$TmpDir = Join-Path $RepoRoot "tmp"
$script:RequestRetries = $RequestRetries

function Get-BaseUri([string]$Url) {
    if (-not $Url.EndsWith("/")) {
        $Url = "$Url/"
    }
    return [uri]$Url
}

function Join-Url([uri]$BaseUri, [string]$RelativePath) {
    return ([uri]::new($BaseUri, $RelativePath)).AbsoluteUri
}

function Get-HeaderValue($Headers, [string]$Name) {
    if ($null -eq $Headers) {
        return ""
    }

    try {
        $values = $null
        if ($Headers.PSObject.Methods.Name -contains "TryGetValues" -and $Headers.TryGetValues($Name, [ref]$values)) {
            return (@($values) -join "; ")
        }

        $value = $Headers[$Name]
        if ($null -eq $value) {
            return ""
        }

        return (@($value) -join "; ")
    } catch {
        return ""
    }
}

function Invoke-ExpectedRequest {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus,
        [string]$ContentTypePattern = ""
    )

    $response = $null
    $statusCode = $null
    $contentType = ""
    $maxAttempts = [math]::Max(1, $script:RequestRetries + 1)

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -Headers @{"Cache-Control" = "no-cache"} -MaximumRedirection 5 -TimeoutSec 20 -ErrorAction Stop
            $statusCode = [int]$response.StatusCode
            $contentType = Get-HeaderValue $response.Headers "Content-Type"
            break
        } catch {
            $errorResponse = $null
            try {
                $errorResponse = $_.Exception.Response
            } catch {
                $errorResponse = $null
            }

            if ($null -ne $errorResponse) {
                $statusCode = [int]$errorResponse.StatusCode
                $contentType = Get-HeaderValue $errorResponse.Headers "Content-Type"
                break
            }

            if ($attempt -lt $maxAttempts) {
                Write-Warning ("Request failed for {0} on attempt {1}/{2}: {3}" -f $Name, $attempt, $maxAttempts, $_.Exception.Message)
                Start-Sleep -Seconds 1
                continue
            }

            throw "Request failed for ${Name}: $Url. $($_.Exception.Message)"
        }
    }

    if ($statusCode -ne $ExpectedStatus) {
        throw "${Name}: expected HTTP $ExpectedStatus, got HTTP $statusCode at $Url"
    }

    if ($ContentTypePattern -and $statusCode -ge 200 -and $statusCode -lt 300 -and $contentType -notmatch $ContentTypePattern) {
        throw "${Name}: expected Content-Type matching '$ContentTypePattern', got '$contentType' at $Url"
    }

    Write-Host ("OK {0}: HTTP {1} {2}" -f $Name, $statusCode, $contentType)
    return $response
}

function Get-RemoteCertificateSummary {
    param(
        [string]$HostName,
        [int]$Port = 443
    )

    $tcp = $null
    $ssl = $null

    try {
        $tcp = [System.Net.Sockets.TcpClient]::new()
        $tcp.Connect($HostName, $Port)

        $callback = {
            param($Sender, $Certificate, $Chain, $SslPolicyErrors)
            return $true
        }
        $ssl = [System.Net.Security.SslStream]::new(
            $tcp.GetStream(),
            $false,
            ($callback -as [System.Net.Security.RemoteCertificateValidationCallback])
        )
        $ssl.AuthenticateAsClient($HostName)

        $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($ssl.RemoteCertificate)
        $daysLeft = [math]::Floor(($cert.NotAfter.ToUniversalTime() - [datetime]::UtcNow).TotalDays)

        return [pscustomobject]@{
            HostName = $HostName
            Subject = $cert.Subject
            Issuer = $cert.Issuer
            NotAfter = $cert.NotAfter
            DaysLeft = $daysLeft
        }
    } finally {
        if ($null -ne $ssl) {
            $ssl.Dispose()
        }
        if ($null -ne $tcp) {
            $tcp.Dispose()
        }
    }
}

function Assert-CertificateFresh {
    param(
        [string]$HostName,
        [int]$WarnDays
    )

    $summary = Get-RemoteCertificateSummary -HostName $HostName
    if ($summary.DaysLeft -lt 0) {
        throw "TLS certificate for $HostName expired on $($summary.NotAfter)."
    }

    if ($summary.DaysLeft -lt $WarnDays) {
        Write-Warning ("TLS certificate for {0} expires soon: {1} ({2} days left)." -f $HostName, $summary.NotAfter, $summary.DaysLeft)
    } else {
        Write-Host ("OK TLS {0}: expires {1} ({2} days left)" -f $HostName, $summary.NotAfter, $summary.DaysLeft)
    }
}

function Test-FutureSubdomain {
    param(
        [string]$HostName,
        [int]$WarnDays,
        [switch]$FailOnIssues
    )

    try {
        $records = @(Resolve-DnsName $HostName -ErrorAction Stop | Where-Object {
            $_.Type -in @("A", "AAAA", "CNAME")
        })
        if ($records.Count -eq 0) {
            throw "No A, AAAA, or CNAME records found."
        }

        Write-Host ("OK DNS {0}: {1} record(s)" -f $HostName, $records.Count)
        Assert-CertificateFresh -HostName $HostName -WarnDays $WarnDays
        Invoke-ExpectedRequest -Name "future home" -Url "https://$HostName/" -ExpectedStatus 200 -ContentTypePattern "text/html" | Out-Null
    } catch {
        $message = "Future subdomain check did not pass for ${HostName}: $($_.Exception.Message)"
        if ($FailOnIssues) {
            throw $message
        }
        Write-Warning $message
    }
}

if (-not (Test-Path -LiteralPath $ValidatorPath)) {
    throw "Validator not found: $ValidatorPath"
}
if (-not (Test-Path -LiteralPath $SafetyAuditPath)) {
    throw "Safety audit not found: $SafetyAuditPath"
}

$baseUri = Get-BaseUri $BaseUrl
$hostName = $baseUri.Host

Write-Host ("Checking public-lite live URL: {0}" -f $baseUri.AbsoluteUri)

Invoke-ExpectedRequest -Name "home" -Url (Join-Url $baseUri "") -ExpectedStatus 200 -ContentTypePattern "text/html" | Out-Null
Invoke-ExpectedRequest -Name "FAQ" -Url (Join-Url $baseUri "faq.html") -ExpectedStatus 200 -ContentTypePattern "text/html" | Out-Null
if ($CheckExtendedPages) {
    Invoke-ExpectedRequest -Name "rules" -Url (Join-Url $baseUri "rules.html") -ExpectedStatus 200 -ContentTypePattern "text/html" | Out-Null
    Invoke-ExpectedRequest -Name "privacy" -Url (Join-Url $baseUri "privacy.html") -ExpectedStatus 200 -ContentTypePattern "text/html" | Out-Null
}
$swResponse = Invoke-ExpectedRequest -Name "service worker" -Url (Join-Url $baseUri "sw.js") -ExpectedStatus 200
if ($ExpectedCacheName -and $swResponse.Content -notmatch [regex]::Escape($ExpectedCacheName)) {
    throw "service worker does not contain expected cache name '$ExpectedCacheName'."
}
if ($ExpectedCacheName) {
    Write-Host "OK service worker cache: $ExpectedCacheName"
}
$reportsResponse = Invoke-ExpectedRequest -Name "reports.json" -Url (Join-Url $baseUri "reports.json") -ExpectedStatus 200 -ContentTypePattern "application/json"
Invoke-ExpectedRequest -Name "api/context.php" -Url (Join-Url $baseUri "api/context.php") -ExpectedStatus 200 -ContentTypePattern "application/json" | Out-Null
Invoke-ExpectedRequest -Name "pending queue direct read" -Url (Join-Url $baseUri "submissions/observations-pending.jsonl") -ExpectedStatus 403 | Out-Null

Assert-CertificateFresh -HostName $hostName -WarnDays $CertificateWarnDays

New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
$liveReportsPath = Join-Path $TmpDir ("live-reports-check-{0}.json" -f ([System.Guid]::NewGuid().ToString("N")))

try {
    [System.IO.File]::WriteAllText($liveReportsPath, $reportsResponse.Content, [System.Text.UTF8Encoding]::new($false))
    & $ValidatorPath -Path $liveReportsPath
    & $SafetyAuditPath -Path $liveReportsPath

    $data = $reportsResponse.Content | ConvertFrom-Json
    $reportCount = @($data.reports).Count
    Write-Host ("OK live reports: {0} report(s), updated_at={1}, source={2}" -f $reportCount, $data.updated_at, $data.source)
} finally {
    if (Test-Path -LiteralPath $liveReportsPath) {
        $resolvedTmp = (Resolve-Path -LiteralPath $TmpDir).Path
        $resolvedReports = (Resolve-Path -LiteralPath $liveReportsPath).Path
        if (-not $resolvedReports.StartsWith($resolvedTmp, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove temp file outside tmp: $resolvedReports"
        }
        Remove-Item -LiteralPath $resolvedReports -Force
    }
}

if ($CheckFutureSubdomain) {
    Test-FutureSubdomain -HostName $FutureHost -WarnDays $CertificateWarnDays -FailOnIssues:$FailOnFutureSubdomainIssues
}

Write-Host "Public-lite live check OK."
