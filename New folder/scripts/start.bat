@echo off
echo ======================================
echo  GameMarket - Smart Start
echo ======================================
echo.
echo Detecting configuration...
echo.

cd /d "%~dp0.."
node scripts/start.mjs

if errorlevel 1 (
  echo.
  echo Start failed. Run scripts\install.bat first if dependencies are missing.
  pause
  exit /b 1
)

if "%1"=="" pause
