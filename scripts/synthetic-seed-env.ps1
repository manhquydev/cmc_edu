param(
    [switch]$Fresh
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location $root

if ($env:SYNTH_SEED_ALLOW -ne "1") {
    throw "REFUSING: set SYNTH_SEED_ALLOW=1 to build the synthetic-seed environment."
}

$container = if ($env:SYNTH_PG_CONTAINER) { $env:SYNTH_PG_CONTAINER } else { "cmc-synth-pg" }
$port = if ($env:SYNTH_PG_PORT) { $env:SYNTH_PG_PORT } else { "55432" }
$password = if ($env:SYNTH_PG_PASSWORD) { $env:SYNTH_PG_PASSWORD } else { "synth" }
$databaseName = "cmc_synth"

if ($container -notmatch '^[A-Za-z0-9_.-]+$') { throw "Invalid SYNTH_PG_CONTAINER." }
if ($port -notmatch '^\d{2,5}$') { throw "Invalid SYNTH_PG_PORT." }
if ($password -notmatch '^[A-Za-z0-9_.-]+$') {
    throw "SYNTH_PG_PASSWORD may contain only letters, digits, dot, underscore, and dash."
}

$ownerUrl = "postgresql://postgres:$password@localhost:$port/$databaseName"
$appUrl = "postgresql://cmc_app:$password@localhost:$port/$databaseName"
$env:APP_DATABASE_URL = $appUrl
$env:DATABASE_URL = $ownerUrl

$guardScript = @'
import { assertNotProdDatabase } from "./apps/e2e/src/assert-not-prod.ts";
assertNotProdDatabase(process.env.APP_DATABASE_URL);
assertNotProdDatabase(process.env.DATABASE_URL);
console.log("prod guard OK (both URLs)");
'@
& npx tsx -e $guardScript
if ($LASTEXITCODE -ne 0) { throw "Synthetic database production guard failed." }

if ($Fresh) {
    & docker rm -f $container 2>$null | Out-Null
}

$running = & docker ps --format '{{.Names}}'
if ($running -notcontains $container) {
    Write-Host "Starting dedicated throwaway Postgres container: $container (port $port)"
    & docker run -d --name $container `
        -e "POSTGRES_PASSWORD=$password" `
        -e "POSTGRES_USER=postgres" `
        -p "${port}:5432" `
        postgres:16-alpine | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Unable to start synthetic Postgres container." }
}

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    & docker exec $container pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (!$ready) { throw "Synthetic Postgres did not become ready within 30 seconds." }

$databaseExistsOutput = & docker exec $container psql -U postgres -tAc `
    "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
$databaseExists = if ($null -eq $databaseExistsOutput) {
    ""
} else {
    ([string]$databaseExistsOutput).Trim()
}
if ($databaseExists -ne "1") {
    & docker exec $container psql -U postgres -c "CREATE DATABASE $databaseName" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Unable to create synthetic database." }
}

Write-Host "Applying migrations (prisma migrate deploy)"
& pnpm --filter '@cmc/db' exec prisma migrate deploy | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Synthetic database migration failed." }

& docker exec $container psql -U postgres -d $databaseName -c `
    "ALTER ROLE cmc_app WITH PASSWORD '$password'" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Unable to configure the restricted application role." }

Write-Host "Seeding synthetic data"
& node packages/db/prisma/seed.mjs
if ($LASTEXITCODE -ne 0) { throw "Synthetic database seed failed." }

$expectedCode = & node -e `
    'import("./packages/db/prisma/seed-constants.mjs").then(m => process.stdout.write(m.SYNTHETIC_SEED_FACILITY_CODE))'
$foundCodeOutput = & docker exec $container psql `
    "postgresql://cmc_app:$password@localhost:5432/$databaseName" `
    -tAc "SELECT code FROM `"Facility`" WHERE code = '$expectedCode'"
$foundCode = if ($null -eq $foundCodeOutput) { "" } else { ([string]$foundCodeOutput).Trim() }
if ($foundCode -ne $expectedCode) {
    throw "Synthetic sentinel '$expectedCode' is not readable by cmc_app."
}

Write-Host "Synthetic environment ready. Sentinel facility code: $foundCode"
Write-Host "APP_DATABASE_URL=$appUrl"
Write-Host "DATABASE_URL=$ownerUrl"
