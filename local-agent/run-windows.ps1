$ErrorActionPreference = 'Stop'

$agentDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryDirectory = Split-Path -Parent $agentDirectory

Set-Location -LiteralPath $repositoryDirectory

try {
  $ErrorActionPreference = 'Continue'
  node (Join-Path $agentDirectory 'dispatcher.mjs')
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($exitCode -ne 0) {
    throw "Dispatcher exited with code $exitCode"
  }
} catch {
  throw
}
