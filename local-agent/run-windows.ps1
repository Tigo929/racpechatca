$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$agentDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryDirectory = Split-Path -Parent $agentDirectory
$logDirectory = Join-Path $agentDirectory 'service-logs'
$logFile = Join-Path $logDirectory 'dispatcher.log'

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Location -LiteralPath $repositoryDirectory

try {
  node (Join-Path $agentDirectory 'dispatcher.mjs') 2>&1 |
    Out-File -FilePath $logFile -Append -Encoding utf8
  if ($LASTEXITCODE -ne 0) {
    throw "Dispatcher exited with code $LASTEXITCODE"
  }
} catch {
  "$(Get-Date -Format o) $($_.Exception.Message)" | Out-File -FilePath $logFile -Append -Encoding utf8
  throw
}
