# Hashpop dev setup - run from project root in a terminal where Node/npm are in PATH.
# Requires: Node.js 18-22 (https://nodejs.org/)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Installing root dependencies..." -ForegroundColor Cyan
Set-Location $root
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Cyan
Set-Location "$root\frontend"
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nInstalling backend dependencies..." -ForegroundColor Cyan
Set-Location "$root\backend"
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nGenerating Prisma client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location $root
Write-Host "`nDone. Next steps:" -ForegroundColor Green
Write-Host "  1. (Optional) Start PostgreSQL (e.g. Docker: docker compose up -d) so the backend can run."
Write-Host "  2. (Optional) Run 'npm run db:migrate' in backend to apply migrations."
Write-Host "  3. Start dev: npm run dev"
Write-Host "     - Backend: http://localhost:4000"
Write-Host "     - Frontend: http://localhost:3000"
