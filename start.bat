@echo off
title GoldenEye SAR — Development Stack

echo.
echo  GOLDENEYE SAR — Starting development stack
echo  ============================================
echo.

REM Start the FastAPI backend in a new window
start "GoldenEye API (port 8000)" cmd /k "cd /d %~dp0 && python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload"

REM Give the API a moment to load the model
timeout /t 3 /nobreak > nul

REM Start the Next.js frontend in a new window
start "GoldenEye Frontend (port 3000)" cmd /k "cd /d %~dp0\src\frontend && npm run dev"

echo  API server starting on   http://localhost:8000
echo  Frontend starting on     http://localhost:3000
echo  API health check:        http://localhost:8000/api/health
echo.
echo  Both services are running in separate windows.
echo  Close those windows to stop the servers.
echo.
pause
