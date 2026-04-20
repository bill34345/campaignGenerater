param(
    [string]$GStackRoot = (Join-Path $HOME "gstack"),
    [string]$Url = "https://example.com"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.Arguments = ($Arguments | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_.Replace('"', '\"')) + '"'
        }
        else {
            $_
        }
    }) -join ' '
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        StdOut = $stdout.Trim()
        StdErr = $stderr.Trim()
    }
}

$browseExePath = Join-Path (Join-Path $GStackRoot "browse\dist") "browse.exe"
$startScriptPath = Join-Path $PSScriptRoot "Start-GStackBrowse.ps1"
$runtimeDir = Join-Path $PSScriptRoot "runtime"
$pidPath = Join-Path $runtimeDir "gstack-browse.pid"

if (-not (Test-Path -LiteralPath $browseExePath)) {
    throw "browse.exe not found: $browseExePath"
}

$needsStart = $true
if (Test-Path -LiteralPath $pidPath) {
    $pidText = (Get-Content -LiteralPath $pidPath -Raw).Trim()
    if ($pidText) {
        $process = Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue
        if ($process) {
            $needsStart = $false
        }
    }
}

if ($needsStart) {
    Write-Host "No active PID file found. Starting GStack browse server first..."
    & $startScriptPath -GStackRoot $GStackRoot
}

Write-Host "Testing browse.exe goto against $Url ..."
$gotoResult = Invoke-NativeCommand -FilePath $browseExePath -Arguments @("goto", $Url)
if ($gotoResult.ExitCode -ne 0) {
    throw "browse.exe goto failed.`nSTDOUT:`n$($gotoResult.StdOut)`nSTDERR:`n$($gotoResult.StdErr)"
}

Write-Host "Testing document.title extraction ..."
$titleResult = Invoke-NativeCommand -FilePath $browseExePath -Arguments @("js", "document.title")
if ($titleResult.ExitCode -ne 0) {
    throw "browse.exe js failed.`nSTDOUT:`n$($titleResult.StdOut)`nSTDERR:`n$($titleResult.StdErr)"
}

$result = [ordered]@{
    url = $Url
    gotoOutput = ($gotoResult.StdOut, $gotoResult.StdErr | Where-Object { $_ }) -join " | "
    title = ($titleResult.StdOut, $titleResult.StdErr | Where-Object { $_ }) -join " | "
    checkedAt = (Get-Date).ToString("s")
}

$resultPath = Join-Path $runtimeDir "last-test.json"
$result | ConvertTo-Json | Set-Content -LiteralPath $resultPath

Write-Host ""
Write-Host "GStack browse verification passed."
Write-Host "goto:" $result.gotoOutput
Write-Host "title:" $result.title
Write-Host "Saved result:" $resultPath
