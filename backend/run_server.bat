@echo off
set PYTHONPATH=f:/mini-program/backend
D:\Users\29159\anaconda3\envs\mypytorch\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
