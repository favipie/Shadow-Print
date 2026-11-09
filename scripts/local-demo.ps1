param(
  [ValidateSet('Start','Status','Stop')][string]$Action='Start',
  [int]$Port,
  [string]$PythonExecutable
)
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$state=Join-Path $repo 'backend/.test-output'
if ($Action -ne 'Start') {
  $found=$false
  if (Test-Path -LiteralPath $state) {
    foreach ($file in (Get-ChildItem -LiteralPath $state -Recurse -File -Filter local-demo.json)) {
      $demo=Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
      if ($Port -and $demo.port -ne $Port) { continue }
      $found=$true
      if ($Action -eq 'Stop') {
        if (!$Port) { throw 'Specify -Port with the exact frontend port to stop.' }
        [IO.File]::WriteAllText((Join-Path $file.DirectoryName 'stop'),'')
        Write-Output "Shutdown requested for $($demo.web)."
      } else {
        Write-Output "$($demo.web)  |  certificate SHA-256 $($demo.certificate_sha256)"
        Write-Output ('Invitation: ' + (Join-Path $file.DirectoryName 'local-invitation.txt'))
      }
    }
  }
  if (!$found) { Write-Output 'No matching demo descriptor.' }
  return
}
Push-Location $repo
$oldPath=$env:PYTHONPATH
try {
  if (!$PythonExecutable) {
    $PythonExecutable=Join-Path $repo '.venv/Scripts/python.exe'
    try { & $PythonExecutable -c 'import pyodbc, uvicorn' }
    catch {
      # Use the installed Codex Python when Windows blocks the unsigned venv launcher.
      $node=(Get-Command node.exe).Source
      $deps=Split-Path (Split-Path (Split-Path $node -Parent) -Parent) -Parent
      $PythonExecutable=Join-Path $deps 'python/python.exe'
      if (!(Test-Path -LiteralPath $PythonExecutable)) {
        throw 'Specify -PythonExecutable with an allowed Python 3.12 interpreter.'
      }
    }
  }
  $env:PYTHONPATH=(Resolve-Path '.venv/Lib/site-packages').Path
  & $PythonExecutable -c 'import sys, pyodbc, uvicorn; assert sys.version_info[:2] == (3, 12)'
  if ($LASTEXITCODE -ne 0) { throw 'Use Python 3.12 with the pinned backend dependencies.' }
  & $PythonExecutable backend/hosted_rehearsal.py --demo
  if ($LASTEXITCODE -ne 0) { throw 'The demo supervisor exited with an error.' }
} finally {
  $env:PYTHONPATH=$oldPath
  Pop-Location
}
