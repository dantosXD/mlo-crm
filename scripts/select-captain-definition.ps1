param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("web", "api", "worker", "seaweedfs")]
  [string]$Target
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$source = Join-Path $root "captain-definition.$Target"
$destination = Join-Path $root "captain-definition"

if (-not (Test-Path $source)) {
  throw "Missing source file: $source"
}

Copy-Item $source $destination -Force
Write-Host "Selected captain-definition -> $Target"

