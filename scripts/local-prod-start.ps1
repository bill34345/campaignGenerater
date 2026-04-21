$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$port = 9779
$hostName = "127.0.0.1"
$schemaPath = Join-Path $repoRoot "prisma\\schema.prisma"
$generatedClientPath = Join-Path $repoRoot "node_modules\\.pnpm\\@prisma+client@6.19.3_prism_d64af47a59fcb41d9af9f9685cee22aa\\node_modules\\.prisma\\client\\index.js"

function Invoke-Step {
  param(
    [string]$Label,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Label"

  & $Action
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

function Test-PrismaClientGenerationNeeded {
  if (-not (Test-Path -LiteralPath $generatedClientPath)) {
    return $true
  }

  if (-not (Test-Path -LiteralPath $schemaPath)) {
    return $false
  }

  $schemaTime = (Get-Item -LiteralPath $schemaPath).LastWriteTimeUtc
  $clientTime = (Get-Item -LiteralPath $generatedClientPath).LastWriteTimeUtc
  return $schemaTime -gt $clientTime
}

function Get-LatestWriteTimeUtc {
  param(
    [string[]]$Paths
  )

  $latest = [datetime]::MinValue

  foreach ($path in $Paths) {
    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }

    $item = Get-Item -LiteralPath $path
    if ($item.PSIsContainer) {
      $candidate = Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

      if ($candidate -and $candidate.LastWriteTimeUtc -gt $latest) {
        $latest = $candidate.LastWriteTimeUtc
      }
    }
    elseif ($item.LastWriteTimeUtc -gt $latest) {
      $latest = $item.LastWriteTimeUtc
    }
  }

  return $latest
}

Set-Location -LiteralPath $repoRoot

$envExamplePath = Join-Path $repoRoot ".env.example"
$envPath = Join-Path $repoRoot ".env"
$nodeModulesPath = Join-Path $repoRoot "node_modules"
$buildIdPath = Join-Path $repoRoot ".next\BUILD_ID"
$buildInputs = @(
  (Join-Path $repoRoot "src"),
  (Join-Path $repoRoot "prisma"),
  (Join-Path $repoRoot "public"),
  (Join-Path $repoRoot "package.json"),
  (Join-Path $repoRoot "next.config.ts"),
  (Join-Path $repoRoot "postcss.config.js"),
  (Join-Path $repoRoot "tailwind.config.ts"),
  (Join-Path $repoRoot "tailwind.config.js"),
  (Join-Path $repoRoot "components.json")
)

if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "Port $port already has a listening process. Skipping startup."
  exit 0
}

if (-not (Test-Path -LiteralPath $envPath) -and (Test-Path -LiteralPath $envExamplePath)) {
  Copy-Item -LiteralPath $envExamplePath -Destination $envPath
  Write-Host "Created .env from .env.example"
}

if (-not (Test-Path -LiteralPath $nodeModulesPath)) {
  Invoke-Step "Installing dependencies" { pnpm install }
}
else {
  Write-Host "Dependencies already installed, skipping pnpm install"
}

Invoke-Step "Applying production Prisma migrations" { pnpm exec prisma migrate deploy }

if (Test-PrismaClientGenerationNeeded) {
  Invoke-Step "Generating Prisma client" { pnpm prisma:generate }
}
else {
  Write-Host "Prisma client is up to date, skipping pnpm prisma:generate"
}

$needsBuild = -not (Test-Path -LiteralPath $buildIdPath)
if (-not $needsBuild) {
  $latestInputTime = Get-LatestWriteTimeUtc -Paths $buildInputs
  $buildTime = (Get-Item -LiteralPath $buildIdPath).LastWriteTimeUtc
  $needsBuild = $latestInputTime -gt $buildTime
}

if ($needsBuild) {
  Invoke-Step "Building production bundle" { pnpm build }
}
else {
  Write-Host "Production build is up to date, skipping pnpm build"
}

Write-Host ""
Write-Host "==> Starting Next.js production server on http://$hostName`:$port"
pnpm exec next start -H $hostName -p $port
exit $LASTEXITCODE
