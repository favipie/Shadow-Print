param([string]$ScriptDomPath = 'C:\Program Files\Microsoft SQL Server Management Studio 22\Release\Common7\IDE\Extensions\Application\Microsoft.SqlServer.TransactSql.ScriptDom.dll')
$ErrorActionPreference='Stop'
Add-Type -Path $ScriptDomPath
$parser = [Microsoft.SqlServer.TransactSql.ScriptDom.TSql170Parser]::new($true)
$failures=0
Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.sql' | ForEach-Object {
 $sql=[IO.File]::ReadAllText($_.FullName)
 # SQLCMD directives are client commands, not T-SQL. Individual included files are parsed separately.
 $sql=[regex]::Replace($sql,'(?m)^:.*$','')
 $errors=$null
 $reader=[IO.StringReader]::new($sql)
 $null=$parser.Parse($reader,[ref]$errors)
 foreach($err in $errors){ Write-Output "$($_.Name):$($err.Line): $($err.Message)"; $failures++ }
 if($errors.Count -eq 0){Write-Output "PARSE PASS: $($_.Name)"}
 $reader.Dispose()
}
if($failures){throw "$failures parse errors"}
Write-Output 'Static parser only: no SQL connection or execution performed.'
