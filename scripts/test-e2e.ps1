$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$pythonExe = Join-Path $repo '.venv/Scripts/python.exe'
$nodeExe = (Get-Command node).Source
$apiProcess = $null
$webProcess = $null
$testDatabase = $null
$oldDatabase = $env:SHADOWPRINT_DATABASE
$oldOrigins = $env:SHADOWPRINT_ORIGINS
$oldApi = $env:NEXT_PUBLIC_API_URL
Push-Location $repo
try {
  foreach ($port in @(13000,18000)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Test port $port is already in use." }
  }
  $created = & $pythonExe backend/testing.py create
  if ($LASTEXITCODE -ne 0) { throw 'Disposable database creation failed' }
  $testDatabase = ($created | Select-Object -Last 1).Trim()
  if ($testDatabase -notmatch '^shadowprint_test_[0-9a-f]{32}$') { throw 'Unexpected test database name' }
  $env:SHADOWPRINT_DATABASE = $testDatabase
  $env:SHADOWPRINT_ORIGINS = '["http://127.0.0.1:13000"]'
  $env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:18000'
  $apiProcess = Start-Process -FilePath $pythonExe -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','18000') -WorkingDirectory (Join-Path $repo 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $repo 'backend/.test-output/e2e-api.log') -RedirectStandardError (Join-Path $repo 'backend/.test-output/e2e-api-error.log')
  $webProcess = Start-Process -FilePath $nodeExe -ArgumentList @('node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','13000') -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $repo 'backend/.test-output/e2e-web.log') -RedirectStandardError (Join-Path $repo 'backend/.test-output/e2e-web-error.log')
  foreach ($url in @('http://127.0.0.1:18000/api/health','http://127.0.0.1:13000')) {
    $ready = $false
    for ($attempt=0; $attempt -lt 90; $attempt++) {
      try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null; $ready=$true; break } catch { Start-Sleep -Milliseconds 1000 }
    }
    if (-not $ready) { throw "Service did not become ready: $url" }
  }
  & $nodeExe node_modules/@playwright/test/cli.js test
  if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed; see playwright-report and test-results' }
} finally {
  if ($webProcess -and -not $webProcess.HasExited) {
    # Next dev spawns a server child. Stop only children of this owned process, then the parent.
    Get-CimInstance Win32_Process -Filter "ParentProcessId = $($webProcess.Id)" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Stop-Process -Id $webProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($apiProcess -and -not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue }
  if ($testDatabase -match '^shadowprint_test_[0-9a-f]{32}$') { & $pythonExe backend/testing.py drop $testDatabase }
  $env:SHADOWPRINT_DATABASE=$oldDatabase
  $env:SHADOWPRINT_ORIGINS=$oldOrigins
  $env:NEXT_PUBLIC_API_URL=$oldApi
  Pop-Location
}
