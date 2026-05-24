$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

node scripts/publish_lifemagazine_latest_approved.mjs
