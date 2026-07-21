param(
    [string]$Database = $env:HARNESS_DB_PATH,
    [string]$Cli = $env:HARNESS_CLI
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if ([string]::IsNullOrWhiteSpace($Database)) {
    $Database = Join-Path $root "harness.db"
}
if ([string]::IsNullOrWhiteSpace($Cli)) {
    $Cli = Join-Path $root "scripts/bin/harness-cli.exe"
}
$Database = [System.IO.Path]::GetFullPath($Database)
$Cli = [System.IO.Path]::GetFullPath($Cli)
$defaultDatabase = [System.IO.Path]::GetFullPath((Join-Path $root "harness.db"))
$sourceCheckout = (Test-Path (Join-Path $root "Cargo.toml")) -and
    (Test-Path (Join-Path $root "crates/harness-cli/Cargo.toml"))

$releaseTagFile = Join-Path $root "scripts/harness-cli-release-tag"
if (!(Test-Path $releaseTagFile)) {
    throw "Harness bootstrap failed: pinned release file is missing: $releaseTagFile"
}
$releaseTag = (Get-Content -LiteralPath $releaseTagFile | Where-Object {
    $_ -match "\S" -and $_ -notmatch "^\s*#"
} | Select-Object -First 1).Trim()
if (!$releaseTag.StartsWith("harness-cli-v")) {
    throw "Harness bootstrap failed: invalid pinned release tag: $releaseTag"
}

function Install-PinnedHarnessCli {
    param(
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][string]$Tag
    )

    $architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    if ($architecture -ne [System.Runtime.InteropServices.Architecture]::X64) {
        throw "Harness bootstrap failed: no pinned Windows artifact for architecture $architecture"
    }

    $asset = "harness-cli-windows-x64.exe"
    $baseUrl = $env:HARNESS_CLI_BASE_URL
    if ([string]::IsNullOrWhiteSpace($baseUrl)) {
        $baseUrl = "https://github.com/hoangnb24/repository-harness/releases/download/$Tag"
    }
    $baseUrl = $baseUrl.TrimEnd("/")
    $temporaryCli = [System.IO.Path]::GetTempFileName()
    $temporaryChecksum = [System.IO.Path]::GetTempFileName()

    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$asset" -OutFile $temporaryCli
        Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$asset.sha256" -OutFile $temporaryChecksum
        $expected = ((Get-Content -Raw -LiteralPath $temporaryChecksum).Trim() -split "\s+")[0].ToLowerInvariant()
        if ($expected -notmatch "^[0-9a-f]{64}$") {
            throw "release checksum is malformed"
        }
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $temporaryCli).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            throw "checksum mismatch for $asset"
        }

        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
        Move-Item -LiteralPath $temporaryCli -Destination $Destination -Force
        Write-Host "Installed pinned Harness CLI: tag=$Tag asset=$asset"
    } catch {
        throw "Harness bootstrap failed: unable to install pinned CLI $Tag ($($_.Exception.Message))"
    } finally {
        if (Test-Path $temporaryCli) { Remove-Item -LiteralPath $temporaryCli -Force }
        if (Test-Path $temporaryChecksum) { Remove-Item -LiteralPath $temporaryChecksum -Force }
    }
}

if ($sourceCheckout -and $Database -eq $defaultDatabase -and !(Test-Path $Database)) {
    throw "Harness bootstrap failed: authoritative core state is unavailable; restore the verified core epoch instead of initializing an empty replacement"
}

if ($sourceCheckout) {
    if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
        throw "Harness bootstrap failed: cargo is required in a Harness CLI source checkout"
    }
    & cargo build --quiet --manifest-path (Join-Path $root "Cargo.toml") -p harness-cli --locked
    if ($LASTEXITCODE -ne 0) { throw "Harness bootstrap failed: cargo build failed" }
    $builtCli = Join-Path $root "target/debug/harness-cli.exe"
    if ([System.IO.Path]::GetFullPath($builtCli) -ne [System.IO.Path]::GetFullPath($Cli)) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Cli) | Out-Null
        Copy-Item -LiteralPath $builtCli -Destination $Cli -Force
    }
} elseif (!(Test-Path $Cli)) {
    Install-PinnedHarnessCli -Destination $Cli -Tag $releaseTag
}

$actualVersion = (& $Cli --version).Split()[-1]
$expectedVersion = $releaseTag -replace '^harness-cli-v', ''
if (!$releaseTag.StartsWith("harness-cli-v") -or $actualVersion -ne $expectedVersion) {
    throw "Harness bootstrap failed: CLI version $actualVersion does not match pinned release $releaseTag"
}

function Get-Contract {
    $env:HARNESS_REPO_ROOT = $root
    $env:HARNESS_DB_PATH = $Database
    $json = & $Cli query contract --json
    if ($LASTEXITCODE -ne 0) { throw "Harness bootstrap failed: query contract failed" }
    return ($json | ConvertFrom-Json).result
}

$contract = Get-Contract
$initializedDatabase = $false
switch ($contract.database_state) {
    "missing" {
        & $Cli init | Out-Null
        $initializedDatabase = $true
    }
    "needs_migration" { & $Cli migrate | Out-Null }
    "current" { }
    "unsupported" { throw "Harness bootstrap failed: database schema is outside the CLI's supported range" }
    default { throw "Harness bootstrap failed: query contract returned an unknown database state" }
}
if ($LASTEXITCODE -ne 0) { throw "Harness bootstrap failed: database initialization or migration failed" }

if ($initializedDatabase) {
    $baseline = Join-Path $root ".harness/changesets/cmc-story-baseline-v1.changeset.jsonl"
    if (!(Test-Path $baseline)) {
        throw "Harness bootstrap failed: portable story baseline is missing: $baseline"
    }
    & $Cli db changeset apply $baseline --json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Harness bootstrap failed: portable story baseline apply failed" }
    & $Cli import brownfield | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Harness bootstrap failed: brownfield metadata import failed" }
}

$contract = Get-Contract
if ($contract.database_state -ne "current") {
    throw "Harness bootstrap failed: database did not reach current schema"
}
if ($sourceCheckout -and $Database -eq $defaultDatabase) {
    $stories = (& $Cli query stories --json | ConvertFrom-Json).result.stories
    $ownershipPath = Join-Path $root "docs/stories/epics/E11-symphony-repository-separation/US-089-separation-boundary-and-frozen-baselines/evidence/durable-ownership-map.json"
    $forbidden = (Get-Content -LiteralPath $ownershipPath -Raw | ConvertFrom-Json).records |
        Where-Object { $_.table -eq "story" -and $_.owner -eq "symphony" } |
        ForEach-Object { $_.identity }
    $leaked = $stories | Where-Object { $forbidden -contains $_.id }
    if ($leaked) {
        throw "Harness bootstrap failed: core database contains Symphony-owned story state: $(($leaked.id | Sort-Object) -join ', ')"
    }
    foreach ($proxy in @("US-093", "US-094", "US-095", "US-096")) {
        if (!($stories | Where-Object { $_.id -eq $proxy -and $_.status -eq "implemented" -and !$_.runnable })) {
            throw "Harness bootstrap failed: required core receipt proxy is missing or invalid: $proxy"
        }
    }
    $foreignTools = & $Cli query tools --json | ConvertFrom-Json | Where-Object {
        $_.name -in @("impeccable", "web-ui-build", "web-ui-e2e", "web-ui-desktop-smoke")
    }
    if ($foreignTools) {
        throw "Harness bootstrap failed: core tool registry contains product-owned providers: $(($foreignTools.name | Sort-Object) -join ', ')"
    }
}
Write-Host "Harness ready: cli=$Cli database=$Database"
