@echo off
setlocal enabledelayedexpansion

REM =============================================================
REM Git Push Completion Script
REM =============================================================
REM This script cleans up the broken rebase state and pushes to GitHub

cd /d c:\Users\kotha\VK\Crickeon

echo [*] Cleaning up rebase state...

REM Remove rebase-merge directory (forcefully)
if exist .git\rebase-merge (
    echo [*] Removing .git\rebase-merge...
    for /d %%X in (.git\rebase-merge\*) do rd /s /q "%%X" 2>nul
    del /q .git\rebase-merge\* 2>nul
    rmdir .git\rebase-merge 2>nul
    if exist .git\rebase-merge (
        echo [!] Failed to remove .git\rebase-merge
    ) else (
        echo [OK] Cleaned .git\rebase-merge
    )
)

REM Remove REBASE_HEAD if it exists
if exist .git\REBASE_HEAD (
    del /f .git\REBASE_HEAD 2>nul
    echo [OK] Removed .git\REBASE_HEAD
)

REM Remove editor swap files
del /f .git\.COMMIT_EDITMSG.sw* 2>nul
del /f .git\COMMIT_EDITMSG 2>nul
del /f .git\MERGE_MSG 2>nul
echo [OK] Cleaned editor artifacts

echo.
echo [*] Verifying Git state...
git config core.pager ""
git status --short
git branch -v
git remote -v

echo.
echo [*] Verifying commits...
git log --oneline -5

echo.
echo [*] Pushing to GitHub...
git push -u origin main

echo.
if errorlevel 1 (
    echo [!] Push failed - see errors above
    exit /b 1
) else (
    echo [OK] Push successful!
    git branch -vv
    exit /b 0
)
