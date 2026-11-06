param(
  [ValidateSet('Api','Web')][string]$Service = 'Api',
  [string]$NodeExecutable = 'node'
)
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
if ($Service -eq 'Api') {
  Push-Location (Join-Path $repo 'backend')
  try { & (Join-Path $repo '.venv/Scripts/python.exe') -m uvicorn app.main:app --host 127.0.0.1 --port 8000 }
  finally { Pop-Location }
} else {
  Push-Location $repo
  try {
    $resolvedNode = (Get-Command $NodeExecutable -ErrorAction Stop).Source
    $env:PATH = (Split-Path $resolvedNode -Parent) + ';' + $env:PATH
    & $resolvedNode node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3000
  }
  finally { Pop-Location }
}
