@echo off
echo ============================================
echo  i面试 - Production Server
echo ============================================
echo.
echo 1. Checking PostgreSQL...
"C:\Program Files\PostgreSQL\16\bin\pg_isready.exe" -h localhost >nul 2>&1
if %errorlevel% neq 0 (
    echo    PostgreSQL is not running. Starting...
    "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D "C:\Users\siyua\postgresql\data" -l C:\Users\siyua\postgresql\logfile start
    timeout /t 3 /nobreak >nul
) else (
    echo    PostgreSQL is running.
)

echo.
echo 2. Starting i面试 on http://localhost:3000 ...
echo.
npx next start -p 3000
