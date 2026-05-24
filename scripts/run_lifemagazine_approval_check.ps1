$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

node scripts/telegram_check_lifemagazine_approvals.mjs
