$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$pythonExe = Join-Path $repo '.venv/Scripts/python.exe'
$testDatabase = $null
$oldUrl = $env:SHADOWPRINT_TEST_DATABASE_URL
$oldKey = $env:SHADOWPRINT_API_KEY
Push-Location $repo
try {
  foreach ($port in @(3002,8001)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Test port $port is already in use." }
  }
  $created = & $pythonExe backend/testing.py create
  if ($LASTEXITCODE -ne 0) { throw 'Disposable database creation failed' }
  $testDatabase = ($created | Select-Object -Last 1).Trim()
  if ($testDatabase -notmatch '^shadowprint_test_[0-9a-f]{32}$') { throw 'Unexpected database name' }
  $env:SHADOWPRINT_TEST_DATABASE_URL = & $pythonExe backend/testing.py url $testDatabase
  $env:SHADOWPRINT_API_KEY = & $pythonExe -c 'import secrets; print(secrets.token_urlsafe(48))'
  & node node_modules/@playwright/test/cli.js test
  if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed; see playwright-report and test-results' }
} finally {
  if ($testDatabase -match '^shadowprint_test_[0-9a-f]{32}$') { & $pythonExe backend/testing.py drop $testDatabase }
  $env:SHADOWPRINT_TEST_DATABASE_URL = $oldUrl
  $env:SHADOWPRINT_API_KEY = $oldKey
  Pop-Location
}
