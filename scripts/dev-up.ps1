$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$schemaPath = Join-Path $repoRoot "prisma\\schema.prisma"
$generatedClientPath = Join-Path $repoRoot "node_modules\\.pnpm\\@prisma+client@6.19.3_prism_d64af47a59fcb41d9af9f9685cee22aa\\node_modules\\.prisma\\client\\index.js"
$localProdPort = 9779

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

Set-Location -LiteralPath $repoRoot

$envExamplePath = Join-Path $repoRoot ".env.example"
$envPath = Join-Path $repoRoot ".env"
$nodeModulesPath = Join-Path $repoRoot "node_modules"

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

Invoke-Step "Applying Prisma migrations" { pnpm exec prisma migrate dev --skip-generate }

$needsPrismaGenerate = Test-PrismaClientGenerationNeeded
if ($needsPrismaGenerate) {
  if (Get-NetTCPConnection -LocalPort $localProdPort -State Listen -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "Prisma schema changed, but the local production server is still running on port $localProdPort."
    Write-Host "Stop the local server first, then run pnpm boot again."
    exit 1
  }

  Invoke-Step "Generating Prisma client" { pnpm prisma:generate }
}
else {
  Write-Host "Prisma client is up to date, skipping pnpm prisma:generate"
}

Invoke-Step "Validating Prisma schema" { pnpm exec prisma validate }

Write-Host ""
Write-Host "==> Starting Next.js dev server"
pnpm dev
exit $LASTEXITCODE
