@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

:: =============================================================================
::  GameMarket — Quick Push to GitHub
::  Otomatis pull + rebase + push ke GitHub
::  Usage: klik 2x github-upload.bat
:: =============================================================================

:: ── Warna helper ──────────────────────────────────────────────────────────
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "CYAN=[96m"
set "RESET=[0m"

call :header
echo.

:: ── Check Git installed ────────────────────────────────────────────────────
where git >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%RESET% Git tidak ditemukan^^!
    echo.
    echo Install Git dari: https://git-scm.com/download/win
    echo Setelah install, restart CMD/terminal lalu coba lagi.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('git --version') do set GIT_VER=%%v
echo %GREEN%[✓]%RESET% %GIT_VER%

:: ── Pindah ke root project ─────────────────────────────────────────────────
cd /d "%~dp0.."
set "PROJECT_DIR=%CD%"
echo %CYAN%[i]%RESET% Project dir : %PROJECT_DIR%

:: ── Check .git ────────────────────────────────────────────────────────────
set IS_NEW_REPO=0
if not exist ".git" (
    set IS_NEW_REPO=1
    echo %YELLOW%[i]%RESET% Belum ada Git repository di folder ini.
) else (
    for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%b
    for /f "tokens=*" %%r in ('git remote get-url origin 2^>nul') do set CURRENT_REMOTE=%%r
    for /f "tokens=*" %%u in ('git config user.name 2^>nul') do set GIT_USER=%%u
    for /f "tokens=*" %%e in ('git config user.email 2^>nul') do set GIT_EMAIL=%%e
    echo %GREEN%[✓]%RESET% Git repository ditemukan
    if not "!CURRENT_BRANCH!"=="" echo %CYAN%[i]%RESET% Branch         : !CURRENT_BRANCH!
    if not "!CURRENT_REMOTE!"=="" echo %CYAN%[i]%RESET% Remote origin  : !CURRENT_REMOTE!
    if not "!GIT_USER!"==""       echo %CYAN%[i]%RESET% User           : !GIT_USER! ^(!GIT_EMAIL!^)
)

:: ── Load saved config ─────────────────────────────────────────────────────
set SAVED_URL=
set SAVED_BRANCH=
if exist "%~dp0github-config.txt" (
    for /f "tokens=1,* delims==" %%a in (%~dp0github-config.txt) do (
        if "%%a"=="GITHUB_URL" set SAVED_URL=%%b
        if "%%a"=="BRANCH"     set SAVED_BRANCH=%%b
    )
)

:: ── Input GitHub repo URL ──────────────────────────────────────────────────
echo.
echo Masukkan URL repository GitHub kamu.
echo Contoh : https://github.com/username/nama-repo.git
if not "!SAVED_URL!"=="" echo %CYAN%[i]%RESET% Tersimpan      : !SAVED_URL!
echo.
set /p GITHUB_URL="GitHub URL (Enter = pakai tersimpan): "
if "!GITHUB_URL!"=="" (
    if "!SAVED_URL!"=="" (
        echo %RED%[ERROR]%RESET% URL tidak boleh kosong.
        pause & exit /b 1
    )
    set "GITHUB_URL=!SAVED_URL!"
    echo %GREEN%[✓]%RESET% Menggunakan URL tersimpan: !GITHUB_URL!
)

:: Validasi minimal mengandung github.com
echo !GITHUB_URL! | findstr /i "github.com" >nul
if errorlevel 1 (
    echo %YELLOW%[WARN]%RESET% URL tidak mengandung 'github.com'. Pastikan URL benar.
    set /p CONT="Lanjutkan tetap? (y/N): "
    if /i not "!CONT!"=="y" exit /b 0
)

:: ── Input branch name ──────────────────────────────────────────────────────
echo.
if not "!SAVED_BRANCH!"=="" (
    set /p BRANCH_INPUT="Nama branch [!SAVED_BRANCH!]: "
    if "!BRANCH_INPUT!"=="" set "BRANCH_INPUT=!SAVED_BRANCH!"
) else (
    set /p BRANCH_INPUT="Nama branch [main]: "
    if "!BRANCH_INPUT!"=="" set BRANCH_INPUT=main
)

:: ── Tampilkan perubahan sejak commit terakhir ─────────────────────────────
echo.
echo ─────────────────────────────────────────
echo %CYAN%[i]%RESET% Perubahan sejak commit terakhir:
git status --short 2>nul
if errorlevel 1 echo   (belum ada commit — semua file baru)
echo ─────────────────────────────────────────

:: ── Input commit message ───────────────────────────────────────────────────
echo.
set /p COMMIT_MSG="Commit message [update]: "
if "!COMMIT_MSG!"=="" set COMMIT_MSG=update

:: ── Konfirmasi ─────────────────────────────────────────────────────────────
echo.
echo ==========================================
echo   Ringkasan:
echo   Repository : !GITHUB_URL!
echo   Branch     : !BRANCH_INPUT!
echo   Commit     : "!COMMIT_MSG!"
echo ==========================================
echo.
set /p CONFIRM="Lanjutkan? (y/N): "
if /i not "!CONFIRM!"=="y" (
    echo Dibatalkan.
    pause & exit /b 0
)
echo.

:: ── Git init (kalau repo baru) ─────────────────────────────────────────────
if !IS_NEW_REPO!==1 (
    echo %CYAN%[→]%RESET% Inisialisasi Git repository...
    git init -b "!BRANCH_INPUT!" >nul 2>&1
    if errorlevel 1 (
        git init >nul 2>&1
        git checkout -b "!BRANCH_INPUT!" >nul 2>&1
    )
    echo %GREEN%[✓]%RESET% Git repository diinisialisasi
    echo.
) else (
    if not "!CURRENT_BRANCH!"=="!BRANCH_INPUT!" (
        if not "!CURRENT_BRANCH!"=="HEAD" (
            echo %CYAN%[→]%RESET% Rename branch '!CURRENT_BRANCH!' ke '!BRANCH_INPUT!'...
            git branch -M "!BRANCH_INPUT!" >nul 2>&1
        )
    )
)

:: ── Check/set git user config ──────────────────────────────────────────────
for /f "tokens=*" %%u in ('git config user.name 2^>nul') do set GIT_USER=%%u
if "!GIT_USER!"=="" (
    echo %YELLOW%[i]%RESET% Git user belum dikonfigurasi.
    set /p GIT_USER="Nama kamu (untuk Git): "
    set /p GIT_EMAIL="Email GitHub kamu: "
    git config user.name "!GIT_USER!"
    git config user.email "!GIT_EMAIL!"
    echo %GREEN%[✓]%RESET% Git user dikonfigurasi: !GIT_USER!
    echo.
)

:: ── Cek / buat .gitignore ─────────────────────────────────────────────────
if not exist ".gitignore" (
    echo %YELLOW%[WARN]%RESET% .gitignore tidak ditemukan — membuat default...
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
        echo *.pem
        echo *.pem.bak
    ) > .gitignore
    echo %GREEN%[✓]%RESET% .gitignore dibuat
)

:: ── Pastikan backend/uploads/.gitkeep ada ─────────────────────────────────
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\uploads\.gitkeep" type nul > "backend\uploads\.gitkeep"

:: ── Set/update remote origin ───────────────────────────────────────────────
echo.
echo %CYAN%[→]%RESET% Mengatur remote origin...
git remote remove origin >nul 2>&1
git remote add origin "!GITHUB_URL!"
echo %GREEN%[✓]%RESET% Remote origin: !GITHUB_URL!

:: ── Pastikan checkout ke branch yang benar ───────────────────────────────
git checkout -b "!BRANCH_INPUT!" >nul 2>&1
if errorlevel 1 (
    git checkout "!BRANCH_INPUT!" >nul 2>&1
    if errorlevel 1 git branch -M "!BRANCH_INPUT!" >nul 2>&1
)

:: ── Stage semua file ───────────────────────────────────────────────────────
echo.
echo %CYAN%[→]%RESET% Staging perubahan...
git add -A
if errorlevel 1 ( echo %RED%[ERROR]%RESET% git add gagal. & pause & exit /b 1 )

:: Cek apakah ada yang di-stage
git diff --cached --quiet >nul 2>&1
if not errorlevel 1 (
    echo %YELLOW%[WARN]%RESET% Tidak ada perubahan baru untuk di-commit.
    echo.
    set /p FORCE_PUSH="Push tetap ke remote? (y/N): "
    if /i not "!FORCE_PUSH!"=="y" (
        echo Selesai — tidak ada yang di-push.
        pause & exit /b 0
    )
    goto :do_pull
)

:: Tampilkan ringkasan yang akan di-commit
echo.
echo %CYAN%[i]%RESET% File yang akan di-commit:
git diff --cached --stat 2>nul
echo.

:: ── Commit ────────────────────────────────────────────────────────────────
echo %CYAN%[→]%RESET% Commit: "!COMMIT_MSG!"
git commit -m "!COMMIT_MSG!"
if errorlevel 1 ( echo %RED%[ERROR]%RESET% git commit gagal. & pause & exit /b 1 )
echo %GREEN%[✓]%RESET% Commit berhasil

:do_pull
:: ── Pull + Rebase (cegah reject "fetch first") ───────────────────────────
echo.
echo %CYAN%[→]%RESET% Memeriksa perubahan di remote (pull --rebase)...
git pull origin "!BRANCH_INPUT!" --rebase >nul 2>&1
set PULL_ERR=!ERRORLEVEL!

:: Cek apakah ada conflict setelah rebase
git diff --name-only --diff-filter=U 2>nul | findstr "." >nul 2>&1
if not errorlevel 1 (
    echo.
    echo %RED%[CONFLICT]%RESET% Ada conflict yang perlu diselesaikan manual^^!
    echo.
    echo File yang conflict:
    git diff --name-only --diff-filter=U
    echo.
    echo Langkah penyelesaian:
    echo   1. Buka file di atas, selesaikan conflict ^(hapus tanda ^^^<^^^<^^^< dst^)
    echo   2. Jalankan: git add .
    echo   3. Jalankan: git rebase --continue
    echo   4. Jalankan script ini lagi
    echo.
    git rebase --abort >nul 2>&1
    echo %YELLOW%[i]%RESET% Rebase dibatalkan. Commit lokal kamu tetap aman.
    pause & exit /b 1
)

if !PULL_ERR! neq 0 (
    :: Remote mungkin belum ada (repo baru) — lanjut push saja
    echo %YELLOW%[i]%RESET% Pull tidak berhasil ^(mungkin repo baru / branch belum ada^) — lanjut push...
)

:do_push
:: ── Push ke GitHub ────────────────────────────────────────────────────────
echo.
echo %CYAN%[→]%RESET% Pushing ke GitHub...
echo     ^(Jika muncul login browser/window, masukkan credentials GitHub kamu^)
echo.
git push -u origin "!BRANCH_INPUT!"

if errorlevel 1 (
    echo.
    echo %RED%[ERROR]%RESET% Push gagal^^!
    echo.
    echo Kemungkinan penyebab:
    echo.
    echo   1. REPOSITORY BELUM DIBUAT di GitHub
    echo      Buat repo baru di: https://github.com/new
    echo      - Jangan centang "Initialize this repository"
    echo      - Klik "Create repository", lalu jalankan script ini lagi.
    echo.
    echo   2. Autentikasi gagal
    echo      Gunakan Personal Access Token ^(bukan password biasa^):
    echo      https://github.com/settings/tokens/new ^(centang: repo^)
    echo.
    echo   3. URL salah: !GITHUB_URL!
    echo.
    set /p RETRY="Coba push lagi? (y/N): "
    if /i "!RETRY!"=="y" (
        echo.
        echo %CYAN%[→]%RESET% Retry push...
        git push -u origin "!BRANCH_INPUT!"
        if errorlevel 1 (
            echo.
            echo %YELLOW%[WARN]%RESET% Masih gagal.
            echo.
            echo Force push akan MENIMPA semua perubahan di remote^^!
            echo Gunakan hanya jika kamu yakin 100%% versi lokal yang benar.
            echo.
            set /p FORCE="Force push? (ketik FORCE untuk konfirmasi): "
            if "!FORCE!"=="FORCE" (
                git push -u origin "!BRANCH_INPUT!" --force
                if errorlevel 1 (
                    echo %RED%[ERROR]%RESET% Force push juga gagal. Cek URL dan koneksi internet.
                    pause & exit /b 1
                )
                echo %YELLOW%[!]%RESET% Force push berhasil — remote telah di-overwrite.
                goto :success
            ) else (
                echo Commit sudah tersimpan lokal. Jalankan script lagi setelah masalah teratasi.
                pause & exit /b 1
            )
        )
    ) else (
        echo Commit sudah tersimpan lokal. Jalankan script lagi setelah membuat repo di GitHub.
        pause & exit /b 1
    )
)

:success
:: ── Sukses ────────────────────────────────────────────────────────────────
echo.
echo ==========================================
echo   %GREEN%[✓] Upload berhasil^^!%RESET%
echo ==========================================
echo.

set "REPO_URL=!GITHUB_URL:.git=!"
echo   Repository : !REPO_URL!
echo   Branch     : !BRANCH_INPUT!
echo   User       : !GIT_USER!
echo.

:: Tampilkan info commit terakhir
for /f "tokens=*" %%h in ('git log -1 --format^="%%h %%s" 2^>nul') do echo   Commit     : %%h
echo.
echo   Buka di browser: !REPO_URL!
echo.

:: ── Simpan config ─────────────────────────────────────────────────────────
(
    echo GITHUB_URL=!GITHUB_URL!
    echo BRANCH=!BRANCH_INPUT!
) > "%~dp0github-config.txt"
echo %CYAN%[i]%RESET% Konfigurasi disimpan ke scripts\github-config.txt

echo.
pause
goto :eof

:: ─────────────────────────────────────────────────────────────────────────
:header
echo.
echo ==========================================
echo   GameMarket - Quick Push to GitHub
echo ==========================================
goto :eof
