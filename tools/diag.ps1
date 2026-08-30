# Diag: check login status then try open with full output
$cli = Get-ChildItem -Path "D:\Program Files (x86)\Tencent" -Recurse -Filter "cli.bat" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $cli) { Write-Error "CLI not found"; exit 1 }
Write-Output "=== islogin ==="
& cmd /c "chcp 65001 >nul & `"$cli`" islogin"
Write-Output "=== open ==="
& cmd /c "chcp 65001 >nul & `"$cli`" open --project `"F:\mini-program`""
Write-Output "=== exit=$LASTEXITCODE ==="
