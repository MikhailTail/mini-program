# WeChat DevTools CLI helper (no non-ASCII chars to avoid encoding issues)
param(
    [string]$Action = "--help"
)
$cli = Get-ChildItem -Path "D:\Program Files (x86)\Tencent" -Recurse -Filter "cli.bat" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $cli) {
    Write-Error "CLI not found"
    exit 1
}
Write-Output "CLI=$cli"
$out = & cmd /c "chcp 65001 >nul & `"$cli`" $Action"
$out | Out-String
