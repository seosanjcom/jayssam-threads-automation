$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ApprovalScript = Join-Path $Root "scripts\run_lifemagazine_approval_check.ps1"
$PublishScript = Join-Path $Root "scripts\run_lifemagazine_publish.ps1"

$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

$ApprovalAction = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ApprovalScript`"" `
    -WorkingDirectory $Root
$ApprovalTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 10) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

Register-ScheduledTask `
    -TaskName "Lifemagazine Threads Approval Check" `
    -Action $ApprovalAction `
    -Trigger $ApprovalTrigger `
    -Settings $Settings `
    -Description "Check Telegram approvals for lifemagazine_ Threads drafts every 10 minutes" `
    -Force | Out-Null

$PublishAction = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PublishScript`"" `
    -WorkingDirectory $Root
$PublishTriggers = @()
$PublishTriggers += New-ScheduledTaskTrigger -Daily -At "18:00"
$PublishTriggers += New-ScheduledTaskTrigger -Daily -At "21:00"

Register-ScheduledTask `
    -TaskName "Lifemagazine Threads Publish" `
    -Action $PublishAction `
    -Trigger $PublishTriggers `
    -Settings $Settings `
    -Description "Publish latest approved lifemagazine_ Threads draft at 18:00 and 21:00 KST" `
    -Force | Out-Null

Write-Output "Registered Lifemagazine Threads local tasks:"
Write-Output "- Lifemagazine Threads Approval Check: every 10 minutes"
Write-Output "- Lifemagazine Threads Publish: daily 18:00, 21:00"
