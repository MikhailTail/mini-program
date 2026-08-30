# start_dev.ps1 - One-command dev launcher
#   backend : FastAPI  on port 8000  (via backend/run_server.bat)
#   frontend: Taro H5  on port 10086 (npm run dev:h5)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tools/start_dev.ps1           # start both
#   powershell -ExecutionPolicy Bypass -File tools/start_dev.ps1 -Stop      # stop both
#   powershell -ExecutionPolicy Bypass -File tools/start_dev.ps1 -BackendOnly
#   powershell -ExecutionPolicy Bypass -File tools/start_dev.ps1 -FrontendOnly
#
# Logs: tools/logs/backend.log and tools/logs/frontend.log

param(
    [switch]$Stop,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"

$root        = Split-Path -Parent $PSScriptRoot
$backendDir  = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$logDir      = Join-Path $root "tools\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$backendLog  = Join-Path $logDir "backend.log"
$frontendLog = Join-Path $logDir "frontend.log"

function Test-Port([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Stop-Port([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

if ($Stop) {
    Write-Output "Stopping backend :8000 and frontend :10086 ..."
    Stop-Port 8000
    Stop-Port 10086
    Start-Sleep -Seconds 1
    Write-Output "Done. Logs kept at: $logDir"
    exit 0
}

# ---- frontend ----
if (-not $BackendOnly) {
    if (Test-Port 10086) {
        Write-Output "[frontend] port 10086 already in use, skip start"
    } else {
        $nodeModules = Join-Path $frontendDir "node_modules"
        if (-not (Test-Path $nodeModules)) {
            Write-Output "[frontend] node_modules not found, running npm install ..."
            Push-Location $frontendDir
            & npm install
            Pop-Location
        }
        Write-Output "[frontend] starting Taro H5 dev server :10086 (log: $frontendLog)"
        Start-Process cmd.exe -ArgumentList "/c npm run dev:h5 > `"$frontendLog`" 2>&1" -WorkingDirectory $frontendDir -WindowStyle Hidden
    }
}

# ---- backend ----
if (-not $FrontendOnly) {
    if (Test-Port 8000) {
        Write-Output "[backend] port 8000 already in use, skip start"
    } else {
        $runBat = Join-Path $backendDir "run_server.bat"
        if (-not (Test-Path $runBat)) {
            Write-Error "backend/run_server.bat not found"; exit 1
        }
        Write-Output "[backend] starting FastAPI :8000 via run_server.bat (log: $backendLog)"
        Start-Process cmd.exe -ArgumentList "/c run_server.bat > `"$backendLog`" 2>&1" -WorkingDirectory $backendDir -WindowStyle Hidden
    }
}

# ---- wait until ready (max 60s) ----
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    $b = Test-Port 8000
    $f = Test-Port 10086
    if (($BackendOnly -or $b) -and ($FrontendOnly -or $f)) { break }
    Start-Sleep -Seconds 2
}

Write-Output ""
if ($FrontendOnly) {
    $f = Test-Port 10086
    if ($f) { Write-Output "[frontend] OK  http://127.0.0.1:10086" }
    else { Write-Output "[frontend] not ready yet, check $frontendLog" }
} elseif ($BackendOnly) {
    $b = Test-Port 8000
    if ($b) { Write-Output "[backend ] OK  http://127.0.0.1:8000" }
    else { Write-Output "[backend ] not ready yet, check $backendLog" }
} else {
    $b = Test-Port 8000
    $f = Test-Port 10086
    if ($b) { Write-Output "[backend ] OK  http://127.0.0.1:8000" }
    else { Write-Output "[backend ] starting... check $backendLog" }
    if ($f) { Write-Output "[frontend] OK  http://127.0.0.1:10086" }
    else { Write-Output "[frontend] compiling... check $frontendLog" }
    Write-Output "Open in browser: http://127.0.0.1:10086"
}
