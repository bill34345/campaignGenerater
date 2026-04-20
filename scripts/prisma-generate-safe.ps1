$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$repoName = Split-Path -Leaf $repoRoot

function Find-EngineFile {
  param(
    [string[]]$Roots,
    [string]$FileName
  )

  foreach ($root in $Roots) {
    if (-not $root -or -not (Test-Path -LiteralPath $root)) {
      continue
    }

    $match = Get-ChildItem -Path $root -Recurse -Filter $FileName -File -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if ($match) {
      return $match.FullName
    }
  }

  return $null
}

$searchRoots = @(
  $repoRoot,
  (Split-Path -Parent $repoRoot),
  (Join-Path $env:USERPROFILE ".config\superpowers\worktrees\$repoName")
) | Select-Object -Unique

if (-not $env:PRISMA_QUERY_ENGINE_LIBRARY) {
  $queryEngine = Find-EngineFile -Roots $searchRoots -FileName "query_engine-windows.dll.node"
  if ($queryEngine) {
    $env:PRISMA_QUERY_ENGINE_LIBRARY = $queryEngine
  }
}

if (-not $env:PRISMA_SCHEMA_ENGINE_BINARY) {
  $schemaEngine = Find-EngineFile -Roots $searchRoots -FileName "schema-engine-windows.exe"
  if ($schemaEngine) {
    $env:PRISMA_SCHEMA_ENGINE_BINARY = $schemaEngine
  }
}

& pnpm exec prisma generate
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
