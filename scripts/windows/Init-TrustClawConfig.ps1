# Installs bundled TrustClaw OpenClaw state into %USERPROFILE%\.openclaw on first run or upgrade.
param(
  [string]$InstallRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$BundledRoot = Join-Path $InstallRoot "bundled-state"
$AgentsRoot = Join-Path $InstallRoot "trustclaw\agents"
$StateDir = Join-Path $env:USERPROFILE ".openclaw"
$MarkerPath = Join-Path $StateDir ".trustclaw-bundled-version"
$ConfigPath = Join-Path $StateDir "openclaw.json"
$ManifestPath = Join-Path $BundledRoot "manifest.json"

if (-not (Test-Path $BundledRoot)) {
  Write-Host "[trustclaw] No bundled-state directory; skipping config install." -ForegroundColor Yellow
  return
}

$BundleVersion = "unknown"
if (Test-Path $ManifestPath) {
  try {
    $manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
    if ($manifest.bundleVersion) { $BundleVersion = [string]$manifest.bundleVersion }
  } catch {}
}

$InstalledVersion = $null
if (Test-Path $MarkerPath) {
  $InstalledVersion = (Get-Content -Raw -LiteralPath $MarkerPath).Trim()
}

$ShouldInstall = -not (Test-Path $ConfigPath) -or ($InstalledVersion -ne $BundleVersion)
if (-not $ShouldInstall) {
  Write-Host "[trustclaw] Bundled config already installed (v$InstalledVersion)." -ForegroundColor DarkGray
  return
}

Write-Host "[trustclaw] Installing bundled config v$BundleVersion -> $StateDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

Get-ChildItem -LiteralPath $BundledRoot -Force | ForEach-Object {
  if ($_.Name -eq "manifest.json") { return }
  $dest = Join-Path $StateDir $_.Name
  if (Test-Path $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
  Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force
}

if (-not (Test-Path $ConfigPath)) {
  throw "Bundled install failed: $ConfigPath missing after copy."
}

$configRaw = Get-Content -Raw -LiteralPath $ConfigPath
$configRaw = $configRaw.Replace("__TRUSTCLAW_BUNDLED_AGENTS_DIR__", $AgentsRoot.Replace("\", "\\"))
$config = $configRaw | ConvertFrom-Json
if (-not $config.plugins) { $config | Add-Member -NotePropertyName plugins -NotePropertyValue (@{}) }
if (-not $config.plugins.entries) { $config.plugins | Add-Member -NotePropertyName entries -NotePropertyValue (@{}) }
if (-not $config.plugins.entries."trustclaw-tra") {
  $config.plugins.entries | Add-Member -NotePropertyName "trustclaw-tra" -NotePropertyValue (@{})
}
$tra = $config.plugins.entries."trustclaw-tra"
if (-not $tra.config) { $tra | Add-Member -NotePropertyName config -NotePropertyValue (@{}) }
$tra.config.agentPacksDir = $AgentsRoot
$config | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

Set-Content -LiteralPath $MarkerPath -Value $BundleVersion -Encoding ASCII
Write-Host "[trustclaw] Config ready at $ConfigPath" -ForegroundColor Green
