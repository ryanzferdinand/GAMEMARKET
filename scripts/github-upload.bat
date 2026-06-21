@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

:: =============================================================================
::  GameMarket — GitHub Upload Script
::  Upload / push project ini ke GitHub repository
::  Usage: klik 2x github-upload.bat
:: =============================================================================

echo.
echo ==========================================
echo   GameMarket - GitHub Upload
echo ==========================================
echo.

:: ── Check Git installed ────────────────────────────────────────────────────
where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git tidak ditemukan!
    echo.
    echo Install Git dari: https://git-scm.com/download/win
    echo Setelah install, restart CMD/terminal lalu coba lagi.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('git --version') do set GIT_VER=%%v
echo [✓] %GIT_VER%

:: ── Pindah ke root project ─────────────────────────────────────────────────
cd /d "%~dp0.."
set PROJECT_DIR=%CD%
echo [i] Project dir : %PROJECT_DIR%
echo.

:: ── Check apakah sudah ada .git ────────────────────────────────────────────
set IS_NEW_REPO=0
if not exist ".git" (
    set IS_NEW_REPO=1
    echo [i] Belum ada Git repository di folder ini.
) else (
    echo [i] Git repository sudah ada.
    for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%b
    echo [i] Branch saat ini : !CURRENT_BRANCH!
    echo.
    for /f "tokens=*" %%r in ('git remote get-url origin 2^>nul') do set CURRENT_REMOTE=%%r
    if not "!CURRENT_REMOTE!"=="" (
        echo [i] Remote origin  : !CURRENT_REMOTE!
        echo.
    )
)

:: ── Input GitHub repo URL ──────────────────────────────────────────────────
echo Masukkan URL repository GitHub kamu.
echo Contoh : https://github.com/username/nama-repo.git
echo          git@github.com:username/nama-repo.git
echo.
set /p GITHUB_URL="GitHub URL: "

if "!GITHUB_URL!"=="" (
    echo [ERROR] URL tidak boleh kosong.
    pause
    exit /b 1
)

:: Validasi minimal mengandung github.com
echo !GITHUB_URL! | findstr /i "github.com" >nul
if errorlevel 1 (
    echo [WARN] URL tidak mengandung 'github.com'. Pastikan URL benar.
    set /p CONT="Lanjutkan tetap? (y/N): "
    if /i not "!CONT!"=="y" exit /b 0
)

:: ── Input branch name ──────────────────────────────────────────────────────
echo.
set /p BRANCH_INPUT="Nama branch [main]: "
if "!BRANCH_INPUT!"=="" set BRANCH_INPUT=main

:: ── Input commit message ───────────────────────────────────────────────────
echo.
set /p COMMIT_MSG="Commit message [update]: "
if "!COMMIT_MSG!"=="" set COMMIT_MSG=update

:: ── Konfirmasi ─────────────────────────────────────────────────────────────
echo.
echo ==========================================
echo   Ringkasan:
echo   URL     : !GITHUB_URL!
echo   Branch  : !BRANCH_INPUT!
echo   Commit  : !COMMIT_MSG!
echo ==========================================
echo.
set /p CONFIRM="Lanjutkan? (y/N): "
if /i not "!CONFIRM!"=="y" (
    echo Dibatalkan.
    pause
    exit /b 0
)

echo.

:: ── Git init (kalau repo baru) ─────────────────────────────────────────────
if !IS_NEW_REPO!==1 (
    echo [→] Inisialisasi Git repository...
    git init -b "!BRANCH_INPUT!"
    if errorlevel 1 (
        git init
        git checkout -b "!BRANCH_INPUT!" >nul 2>&1
    )
    if errorlevel 1 ( echo [ERROR] git init gagal. & pause & exit /b 1 )
    echo [✓] Git repository diinisialisasi
    echo.
) else (
    :: Rename branch ke target jika berbeda
    if not "!CURRENT_BRANCH!"=="!BRANCH_INPUT!" (
        if "!CURRENT_BRANCH!"=="HEAD" (
            :: HEAD artinya belum ada commit sama sekali, branch akan dibuat saat commit
            echo [i] Branch akan dibuat sebagai '!BRANCH_INPUT!' setelah commit pertama
        ) else (
            echo [→] Rename branch '!CURRENT_BRANCH!' ke '!BRANCH_INPUT!'...
            git branch -M "!BRANCH_INPUT!" >nul 2>&1
        )
    )
)

:: ── Check/set git user config ──────────────────────────────────────────────
for /f "tokens=*" %%u in ('git config user.name 2^>nul') do set GIT_USER=%%u
for /f "tokens=*" %%e in ('git config user.email 2^>nul') do set GIT_EMAIL=%%e

if "!GIT_USER!"=="" (
    echo [i] Git user belum dikonfigurasi.
    set /p GIT_USER="Nama kamu (untuk Git): "
    set /p GIT_EMAIL="Email GitHub kamu: "
    git config user.name "!GIT_USER!"
    git config user.email "!GIT_EMAIL!"
    echo [✓] Git user dikonfigurasi
    echo.
) else (
    echo [✓] Git user : !GIT_USER! ^(!GIT_EMAIL!^)
)

:: ── Cek / pastikan .gitignore ada ─────────────────────────────────────────
if not exist ".gitignore" (
    echo [WARN] .gitignore tidak ditemukan — membuat default...
    (
        echo .env
        echo backend/.env
        echo frontend/.env
        echo node_modules/
        echo frontend/node_modules/
        echo backend/node_modules/
        echo frontend/dist/
        echo backend/uploads/*
        echo !backend/uploads/.gitkeep
        echo *.log
        echo .DS_Store
        echo Thumbs.db
    ) > .gitignore
    echo [✓] .gitignore dibuat
)

:: ── Pastikan backend/uploads/.gitkeep ada ─────────────────────────────────
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\uploads\.gitkeep" type nul > "backend\uploads\.gitkeep"

:: ── Set/update remote origin ───────────────────────────────────────────────
echo.
echo [→] Mengatur remote origin...
git remote remove origin >nul 2>&1
git remote add origin "!GITHUB_URL!"
echo [✓] Remote origin: !GITHUB_URL!

:: ── Rename branch ke target ────────────────────────────────────────────────
git checkout -b "!BRANCH_INPUT!" >nul 2>&1
if errorlevel 1 (
    git branch -M "!BRANCH_INPUT!" >nul 2>&1
)
:: ── Stage semua file ───────────────────────────────────────────────────────
echo.
echo [→] Staging semua file...
git add -A
if errorlevel 1 ( echo [ERROR] git add gagal. & pause & exit /b 1 )

:: Tampilkan ringkasan yang akan di-commit
echo.
echo [i] File yang akan di-commit:
git diff --cached --stat 2>nul | head /c 20
echo.

:: Cek apakah ada yang di-stage
git diff --cached --quiet >nul 2>&1
if not errorlevel 1 (
    echo [WARN] Tidak ada perubahan baru untuk di-commit.
    echo.
    set /p FORCE_PUSH="Push tetap ke remote? (y/N): "
    if /i not "!FORCE_PUSH!"=="y" (
        echo Selesai — tidak ada yang di-push.
        pause
        exit /b 0
    )
    goto :do_push
)

:: ── Commit ────────────────────────────────────────────────────────────────
echo [→] Membuat commit...
git commit -m "!COMMIT_MSG!"
if errorlevel 1 ( echo [ERROR] git commit gagal. & pause & exit /b 1 )
echo [✓] Commit berhasil

:do_push
:: ── Push ke GitHub ────────────────────────────────────────────────────────
echo.
echo [→] Pushing ke GitHub...
echo     (Jika muncul login browser/window, masukkan credentials GitHub kamu)
echo.
git push -u origin "!BRANCH_INPUT!"

if errorlevel 1 (
    echo.
    echo [ERROR] Push gagal!
    echo.
    echo Kemungkinan penyebab:
    echo.
    echo   1. REPOSITORY BELUM DIBUAT di GitHub ^(paling sering^)
    echo      Buka browser dan buat repo dulu:
    echo      https://github.com/new
    echo      - Repository name: isi nama repo
    echo      - Jangan centang "Initialize this repository"
    echo      - Klik "Create repository"
    echo      Setelah dibuat, jalankan script ini lagi.
    echo.
    echo   2. Autentikasi gagal
    echo      Gunakan Personal Access Token ^(bukan password biasa^):
    echo      https://github.com/settings/tokens/new
    echo      Centang: repo ^(full control^)
    echo      Salin token, pakai sebagai password saat diminta Git.
    echo.
    echo   3. Nama repo/username salah di URL
    echo      URL yang dipakai: !GITHUB_URL!
    echo.
    set /p RETRY="Coba push lagi sekarang? (y/N): "
    if /i "!RETRY!"=="y" (
        echo.
        echo [→] Retry push...
        git push -u origin "!BRANCH_INPUT!"
        if errorlevel 1 (
            echo.
            set /p FORCE="Masih gagal. Force push? ^(HATI-HATI: overwrite remote^) (y/N): "
            if /i "!FORCE!"=="y" (
                git push -u origin "!BRANCH_INPUT!" --force
                if errorlevel 1 (
                    echo [ERROR] Force push juga gagal. Cek URL dan buat repo di GitHub dulu.
                    pause & exit /b 1
                )
            ) else (
                echo.
                echo Commit sudah tersimpan lokal. Jalankan script lagi setelah repo dibuat.
                pause & exit /b 1
            )
        )
    ) else (
        echo.
        echo Commit sudah tersimpan lokal. Jalankan script lagi setelah membuat repo di GitHub.
        pause & exit /b 1
    )
)

:: ── Sukses ────────────────────────────────────────────────────────────────
echo.
echo ==========================================
echo   [✓] Upload berhasil!
echo ==========================================
echo.

:: Tampilkan URL repo (bersihkan .git dari akhir URL)
set REPO_URL=!GITHUB_URL!
set REPO_URL=!REPO_URL:.git=!
echo   Repository : !REPO_URL!
echo   Branch     : !BRANCH_INPUT!
echo.
echo   Buka di browser: !REPO_URL!
echo.

:: ── Simpan URL ke file config ──────────────────────────────────────────────
echo GITHUB_URL=!GITHUB_URL!> "%~dp0github-config.txt"
echo BRANCH=!BRANCH_INPUT!>> "%~dp0github-config.txt"
echo [i] Konfigurasi disimpan ke scripts\github-config.txt

echo.
pause
