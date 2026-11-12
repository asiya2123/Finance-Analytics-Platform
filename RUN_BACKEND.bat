@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo Finance Analytics Platform - Frontend + FastAPI Backend
echo ================================================
python --version >nul 2>&1
if errorlevel 1 (
  echo Python was not found. Install Python 3.11 or newer and enable Add Python to PATH.
  pause
  exit /b 1
)
python -m pip install -r backend\requirements.txt
if errorlevel 1 (
  echo Dependency installation failed. Check Python and your internet connection.
  pause
  exit /b 1
)
echo.
echo Starting server...
echo Dashboard: http://127.0.0.1:8000
echo API docs:  http://127.0.0.1:8000/docs
echo Health:    http://127.0.0.1:8000/api/health
echo Press CTRL+C to stop the server.
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
pause
