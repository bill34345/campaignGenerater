param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$AnalyzeArgs
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$preserveDir = Join-Path $repoRoot '.gitnexus-preserve'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $preserveDir (Join-Path 'backups' $timestamp)
$startMarker = '<!-- gitnexus:start -->'
$endMarker = '<!-- gitnexus:end -->'
$targetFiles = @('AGENTS.md', 'CLAUDE.md')

function Get-UserContent {
    param(
        [string]$Content
    )

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return ''
    }

    $startIndex = $Content.IndexOf($startMarker)
    $endIndex = $Content.IndexOf($endMarker)

    if ($startIndex -lt 0 -or $endIndex -le $startIndex) {
        return $Content.Trim("`r", "`n")
    }

    $before = $Content.Substring(0, $startIndex).Trim("`r", "`n")
    $afterStart = $endIndex + $endMarker.Length
    $after = ''

    if ($afterStart -lt $Content.Length) {
        $after = $Content.Substring($afterStart).Trim("`r", "`n")
    }

    if ($before -and $after) {
        return "$before`r`n`r`n$after"
    }

    if ($before) {
        return $before
    }

    if ($after) {
        return $after
    }

    return ''
}

function Get-GitNexusSection {
    param(
        [string]$Content
    )

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return $null
    }

    $startIndex = $Content.IndexOf($startMarker)
    $endIndex = $Content.IndexOf($endMarker)

    if ($startIndex -lt 0 -or $endIndex -le $startIndex) {
        return $null
    }

    $sectionLength = ($endIndex + $endMarker.Length) - $startIndex
    return $Content.Substring($startIndex, $sectionLength).Trim("`r", "`n")
}

function Write-Utf8File {
    param(
        [string]$Path,
        [string]$Content
    )

    $directory = Split-Path -Parent $Path
    if ($directory) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }

    $normalized = if ([string]::IsNullOrWhiteSpace($Content)) { '' } else { $Content.Trim("`r", "`n") + "`r`n" }
    [System.IO.File]::WriteAllText($Path, $normalized, [System.Text.UTF8Encoding]::new($false))
}

New-Item -ItemType Directory -Force -Path $preserveDir | Out-Null
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

foreach ($fileName in $targetFiles) {
    $filePath = Join-Path $repoRoot $fileName
    $userSnapshotPath = Join-Path $preserveDir ($fileName + '.user.md')

    if (-not (Test-Path $filePath)) {
        continue
    }

    $rawContent = Get-Content -Raw -Path $filePath
    Copy-Item -LiteralPath $filePath -Destination (Join-Path $backupDir $fileName) -Force
    $userContent = Get-UserContent -Content $rawContent
    Write-Utf8File -Path $userSnapshotPath -Content $userContent
}

$finalAnalyzeArgs = @('analyze', $repoRoot)
if (-not (Test-Path (Join-Path $repoRoot '.git')) -and -not ($AnalyzeArgs -contains '--skip-git')) {
    Write-Host 'No .git directory detected. Appending --skip-git for this run.'
    $finalAnalyzeArgs += '--skip-git'
}
$finalAnalyzeArgs += $AnalyzeArgs

Write-Host ('Running: gitnexus ' + ($finalAnalyzeArgs -join ' '))
& gitnexus @finalAnalyzeArgs

if ($LASTEXITCODE -ne 0) {
    throw "gitnexus analyze failed with exit code $LASTEXITCODE"
}

foreach ($fileName in $targetFiles) {
    $filePath = Join-Path $repoRoot $fileName
    $userSnapshotPath = Join-Path $preserveDir ($fileName + '.user.md')

    if (-not (Test-Path $filePath)) {
        continue
    }

    $generatedContent = Get-Content -Raw -Path $filePath
    $gitNexusSection = Get-GitNexusSection -Content $generatedContent

    if (-not $gitNexusSection) {
        Write-Warning "$fileName does not contain a GitNexus section after analyze. Leaving generated file unchanged."
        continue
    }

    $userContent = ''
    if (Test-Path $userSnapshotPath) {
        $userContent = Get-Content -Raw -Path $userSnapshotPath
        if ($null -eq $userContent) {
            $userContent = ''
        }
        else {
            $userContent = $userContent.Trim("`r", "`n")
        }
    }

    $mergedContent = if ([string]::IsNullOrWhiteSpace($userContent)) {
        $gitNexusSection
    }
    else {
        "$userContent`r`n`r`n$gitNexusSection"
    }

    Write-Utf8File -Path $filePath -Content $mergedContent
}

Write-Host ''
Write-Host "GitNexus analyze completed."
Write-Host "Backups: $backupDir"
Write-Host "User snapshots: $preserveDir"
