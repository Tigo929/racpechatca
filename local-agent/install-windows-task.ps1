$ErrorActionPreference = 'Stop'

$taskName = 'CRM Local Code Agents'
$agentDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$dispatcherPath = Join-Path $agentDirectory 'dispatcher.mjs'
$configPath = Join-Path $agentDirectory 'config.local.json'

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Create $configPath from config.example.json and fill in the CRM credentials first."
}

$nodePath = (Get-Command node.exe).Source
$arguments = "`"$dispatcherPath`""
$action = New-ScheduledTaskAction -Execute $nodePath -Argument $arguments -WorkingDirectory $agentDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RestartCount 20 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Installed and started: $taskName"
