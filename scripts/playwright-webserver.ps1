param(
  [int]$Port = 3101
)

$ErrorActionPreference = "Stop"

& pnpm prisma:generate
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& pnpm exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& pnpm dev --port $Port
exit $LASTEXITCODE
