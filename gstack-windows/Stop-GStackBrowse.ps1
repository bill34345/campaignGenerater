param(
    [string]$GStackRoot = (Join-Path $HOME "gstack")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-GStackBrowseProcess {
    param([Parameter(Mandatory = $true)][string]$ServerNodePath)

    $escaped = [Regex]::Escape($ServerNodePath)
    $candidates = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
    if (-not $candidates) {
        return @()
    }

    return $candidates | Where-Object {
        $_.CommandLine -match $escaped
    }
}

$runtimeDir = Join-Path $PSScriptRoot "runtime"
$pidPath = Join-Path $runtimeDir "gstack-browse.pid"
$metaPath = Join-Path $runtimeDir "gstack-browse.meta.json"

$serverNodePath = Join-Path (Join-Path $GStackRoot "browse\dist") "server-node.mjs"
$stopped = $false

if (Test-Path -LiteralPath $pidPath) {
    $pidText = (Get-Content -LiteralPath $pidPath -Raw).Trim()
    if ($pidText) {
        $pidValue = [int]$pidText
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $pidValue -Force
            Write-Host "Stopped GStack browse server from PID file:" $pidValue
            $stopped = $true
        }
    }
}

$remaining = Get-GStackBrowseProcess -ServerNodePath $serverNodePath
foreach ($process in $remaining) {
    Stop-Process -Id $process.ProcessId -Force
    Write-Host "Stopped matching browse server process:" $process.ProcessId
    $stopped = $true
}

if (Test-Path -LiteralPath $pidPath) {
    Remove-Item -LiteralPath $pidPath -Force
}

if (Test-Path -LiteralPath $metaPath) {
    Remove-Item -LiteralPath $metaPath -Force
}

if (-not $stopped) {
    Write-Host "No running GStack browse server was found."
}
