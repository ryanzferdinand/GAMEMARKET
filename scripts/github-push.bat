@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

:: =============================================================================
::  GameMarket — Quick Push (update ke GitHub)
::  Untuk push update setelah github-upload.bat pernah dijalankan
::  Usage: klik 2x github-push.bat
:: =============================================================================

echo.
echo ==========================================
echo   GameMarket - Quick Push to GitHub
echo ==========================================
echo.

:: ── Check Git ─────────────────────────────────────────────────────────────
where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git tidak ditemukan. Install dari: https://git-scm.com/download/win
    pause & exit /b 1
)

:: ── Pindah ke root project ─────────────────────────────────────────────────
cd /d "%~dp0.."

:: ── Check .git exists ──────────────────────────────────────────────────────
if not exist ".git" (
    echo [ERROR] Belum ada Git repository.
    echo Jalankan github-upload.bat dulu.
    pause & exit /b 1
)

:: ── Load config tersimpan ──────────────────────────────────────────────────
set CONFIG_FILE="%~dp0github-config.txt"
set SAVED_BRANCH=main
if exist %CONFIG_FILE% (
    for /f "tokens=1,2 delims==" %%a in (%CONFIG_FILE%) do (
        if "%%a"=="BRANCH" set SAVED_BRANCH=%%b
        if "%%a"=="GITHUB_URL" set SAVED_URL=%%b
    )
)

:: ── Tampilkan info current state ───────────────────────────────────────────
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%b
for /f "tokens=*" %%r in ('git remote get-url origin 2^>nul') do set REMOTE_URL=%%r
for /f "tokens=*" %%u in ('git config user.name 2^>nul') do set GIT_USER=%%u

echo [i] Repository : !REMOTE_URL!
echo [i] Branch     : !CURRENT_BRANCH!
echo [i] User       : !GIT_USER!
echo.

:: ── Tampilkan perubahan ────────────────────────────────────────────────────
echo [i] Perubahan sejak commit terakhir:
git status --short 2>nul
echo.

:: Check apakah ada perubahan
git status --porcelain 2>nul | findstr /r "." >nul
if errorlevel 1 (
    echo [i] Tidak ada perubahan baru.
    echo.
    :: Cek apakah ada commit yang belum di-push
    for /f %%c in ('git rev-list origin/!CURRENT_BRANCH!..HEAD --count 2^>nul') do set UNPUSHED=%%c
    if "!UNPUSHED!" gtr "0" (
        echo [i] Ada !UNPUSHED! commit yang belum di-push.
        set /p PUSH_ONLY="Push commit tersebut sekarang? (y/N): "
        if /i "!PUSH_ONLY!"=="y" goto :do_push
    )
    echo Tidak ada yang perlu di-push.
    pause & exit /b 0
)

:: ── Input commit message ───────────────────────────────────────────────────
set /p COMMIT_MSG="Commit message [update]: "
if "!COMMIT_MSG!"=="" set COMMIT_MSG=update

echo.
echo [→] Staging perubahan...
git add -A

echo [→] Commit: "!COMMIT_MSG!"
git commit -m "!COMMIT_MSG!"
if errorlevel 1 (
    echo [ERROR] Commit gagal.
    pause & exit /b 1
)

:do_push
echo.
echo [→] Pushing ke GitHub...
git push origin "!CURRENT_BRANCH!"

if errorlevel 1 (
    echo.
    echo [ERROR] Push gagal!
    echo Coba jalankan github-upload.bat ulang untuk setup ulang.
    pause & exit /b 1
)

echo.
echo ==========================================
echo   [✓] Push berhasil!
echo ==========================================
echo.
for /f "tokens=*" %%h in ('git rev-parse --short HEAD 2^>nul') do set COMMIT_HASH=%%h
echo   Commit : !COMMIT_HASH! — !COMMIT_MSG!
echo   Branch : !CURRENT_BRANCH!
echo.
pause
