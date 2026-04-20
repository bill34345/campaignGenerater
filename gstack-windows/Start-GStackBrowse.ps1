param(
    [string]$GStackRoot = (Join-Path $HOME "gstack"),
    [switch]$ForceRebuild,
    [switch]$ForceRestart,
    [switch]$Foreground
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RequiredCommandPath {
    param([Parameter(Mandatory = $true)][string]$Name)

    $command = Get-Command $Name -ErrorAction Stop
    return $command.Source
}

function Get-GStackBrowseProcess {
    param([Parameter(Mandatory = $true)][string]$ServerNodePath)

    $escaped = [Regex]::Escape($ServerNodePath)
    $candidates = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
    if (-not $candidates) {
        return $null
    }

    return $candidates | Where-Object {
        $_.CommandLine -match $escaped
    } | Select-Object -First 1
}

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Write-Utf8NoBomFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Ensure-ServerBundle {
    param(
        [Parameter(Mandatory = $true)][string]$GStackRoot,
        [Parameter(Mandatory = $true)][string]$DistDir,
        [Parameter(Mandatory = $true)][string]$SrcDir,
        [Parameter(Mandatory = $true)][string]$BunPath,
        [switch]$ForceRebuild
    )

    $serverNodePath = Join-Path $DistDir "server-node.mjs"
    $serverJsPath = Join-Path $DistDir "server.js"
    $polyfillSourcePath = Join-Path $SrcDir "bun-polyfill.cjs"
    $polyfillDistPath = Join-Path $DistDir "bun-polyfill.cjs"

    $bundleExists = (Test-Path -LiteralPath $serverNodePath) -and (Test-Path -LiteralPath $polyfillDistPath)
    if ($bundleExists -and -not $ForceRebuild) {
        Write-Host "Reusing existing Node bundle:" $serverNodePath
        return
    }

    Write-Host "Building Windows Node-compatible browse bundle..."
    $buildArgs = @(
        "build",
        (Join-Path $SrcDir "server.ts"),
        "--target=node",
        "--outdir",
        $DistDir,
        "--external", "playwright",
        "--external", "playwright-core",
        "--external", "diff",
        "--external", "bun:sqlite"
    )

    Push-Location $GStackRoot
    try {
        & $BunPath @buildArgs
        if ($LASTEXITCODE -ne 0) {
            throw "bun build failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $serverJsPath)) {
        throw "Expected generated file not found: $serverJsPath"
    }

    $raw = Get-Content -LiteralPath $serverJsPath -Raw
    $raw = $raw -replace 'import \{ Database \} from "bun:sqlite";', 'const Database = null; // bun:sqlite stubbed on Node'
    $raw = $raw -replace 'import\.meta\.dir', '__browseNodeSrcDir'

    $parts = [Regex]::Split($raw, "\r?\n", 2)
    if ($parts.Count -lt 2) {
        throw "Unexpected server.js format; could not inject compatibility header."
    }

    $headerLines = @(
        'import { fileURLToPath as _ftp } from "node:url";',
        'import { dirname as _dn } from "node:path";',
        'const __browseNodeSrcDir = _dn(_dn(_ftp(import.meta.url))) + "/src";',
        '{ const _r = createRequire(import.meta.url); _r("./bun-polyfill.cjs"); }'
    )

    $patched = @(
        $parts[0]
        ($headerLines -join "`n")
        $parts[1]
    ) -join "`n"

    Write-Utf8NoBomFile -Path $serverNodePath -Content $patched
    Copy-Item -LiteralPath $polyfillSourcePath -Destination $polyfillDistPath -Force

    Write-Host "Prepared Node bundle:" $serverNodePath
}

$bunPath = Get-RequiredCommandPath -Name "bun"
$nodePath = Get-RequiredCommandPath -Name "node"

if (-not (Test-Path -LiteralPath $GStackRoot)) {
    throw "GStack root not found: $GStackRoot"
}

$browseRoot = Join-Path $GStackRoot "browse"
$distDir = Join-Path $browseRoot "dist"
$srcDir = Join-Path $browseRoot "src"
$serverNodePath = Join-Path $distDir "server-node.mjs"

if (-not (Test-Path -LiteralPath $distDir)) {
    throw "Browse dist directory not found: $distDir"
}

Ensure-ServerBundle -GStackRoot $GStackRoot -DistDir $distDir -SrcDir $srcDir -BunPath $bunPath -ForceRebuild:$ForceRebuild

$runtimeDir = Join-Path $PSScriptRoot "runtime"
Ensure-Directory -Path $runtimeDir

$pidPath = Join-Path $runtimeDir "gstack-browse.pid"
$stdoutPath = Join-Path $runtimeDir "gstack-browse.stdout.log"
$stderrPath = Join-Path $runtimeDir "gstack-browse.stderr.log"
$metaPath = Join-Path $runtimeDir "gstack-browse.meta.json"

$existing = Get-GStackBrowseProcess -ServerNodePath $serverNodePath
if ($existing -and -not $ForceRestart) {
    $meta = [ordered]@{
        pid = $existing.ProcessId
        serverNode = $serverNodePath
        gstackRoot = $GStackRoot
        startedAt = (Get-Date).ToString("s")
        mode = "reused"
    } | ConvertTo-Json

    Set-Content -LiteralPath $pidPath -Value $existing.ProcessId
    Set-Content -LiteralPath $metaPath -Value $meta

    Write-Host "GStack browse server already running (PID $($existing.ProcessId))."
    Write-Host "PID file:" $pidPath
    Write-Host "Logs:" $stdoutPath
    return
}

if ($existing -and $ForceRestart) {
    Stop-Process -Id $existing.ProcessId -Force
    Start-Sleep -Seconds 1
}

if ($Foreground) {
    Write-Host "Starting GStack browse server in foreground..."
    Push-Location $distDir
    try {
        & $nodePath $serverNodePath
    }
    finally {
        Pop-Location
    }

    exit $LASTEXITCODE
}

if (Test-Path -LiteralPath $stdoutPath) {
    Clear-Content -LiteralPath $stdoutPath
}
else {
    New-Item -ItemType File -Path $stdoutPath | Out-Null
}

if (Test-Path -LiteralPath $stderrPath) {
    Clear-Content -LiteralPath $stderrPath
}
else {
    New-Item -ItemType File -Path $stderrPath | Out-Null
}

Write-Host "Starting GStack browse server in background..."
$process = Start-Process -FilePath $nodePath `
    -ArgumentList @($serverNodePath) `
    -WorkingDirectory $distDir `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

Set-Content -LiteralPath $pidPath -Value $process.Id

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500

    if ($process.HasExited) {
        break
    }

    $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw } else { "" }
    if ($stdout -match 'Server running on (http://127\.0\.0\.1:\d+)') {
        $meta = [ordered]@{
            pid = $process.Id
            serverNode = $serverNodePath
            gstackRoot = $GStackRoot
            startedAt = (Get-Date).ToString("s")
            endpoint = $Matches[1]
            mode = "started"
        } | ConvertTo-Json

        Set-Content -LiteralPath $metaPath -Value $meta
        Write-Host "GStack browse server ready:" $Matches[1]
        Write-Host "PID:" $process.Id
        Write-Host "Stdout log:" $stdoutPath
        Write-Host "Stderr log:" $stderrPath
        $ready = $true
        break
    }
}

if (-not $ready) {
    $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw } else { "" }
    $stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw } else { "" }

    if ($process.HasExited) {
        throw "GStack browse server exited early.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
    }

    throw "Timed out waiting for GStack browse server readiness. Check:`n$stdoutPath`n$stderrPath"
}
