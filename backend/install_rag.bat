@echo off
REM RAG dependency installer (must run in this order due to protobuf/posthog conflicts)
REM Usage: install_rag.bat [python_executable]   (default: python in PATH)
set PY=%1
if "%PY%"=="" set PY=python

echo [1/2] Installing chromadb + sentence-transformers ...
%PY% -m pip install chromadb==0.5.23 sentence-transformers==3.3.1
if errorlevel 1 goto :fail

echo [2/2] Downgrading protobuf (paddle 2.6.2 hard limit) and posthog (chromadb telemetry fix) ...
%PY% -m pip install protobuf==3.20.3 posthog==3.5.0
if errorlevel 1 goto :fail

echo.
echo [OK] RAG dependencies installed. Then run: python test_rag.py [--llm]
goto :eof

:fail
echo.
echo [ERROR] Install failed. Try a domestic mirror, e.g. add:  -i https://mirrors.aliyun.com/pypi/simple/
exit /b 1
