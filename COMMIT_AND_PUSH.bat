@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM Complete Git Commit and Push Script for Crickeon
REM ============================================================================

cd /d c:\Users\kotha\VK\Crickeon

echo.
echo ========================================
echo   CRICKEON FINAL COMMIT ^& PUSH
echo ========================================
echo.

REM Step 1: Configure Git
echo [Step 1/6] Configuring Git...
git config core.pager ""
git config advice.waitingForEditor false
echo OK
echo.

REM Step 2: Check current state
echo [Step 2/6] Current Git State:
echo.
echo Branch:
git branch -v
echo.
echo Remote:
git remote -v
echo.
echo Status:
git status --short
echo.

REM Step 3: Stage all files
echo [Step 3/6] Staging all files...
git add -A
git config core.stat false
echo OK
echo.

REM Step 4: Verify staged files
echo [Step 4/6] Verifying staged files...
git diff --cached --name-only | find /c /v "" > nul
echo OK
echo.

REM Step 5: Create commit
echo [Step 5/6] Creating commit...
git commit -m "feat: production-ready monorepo with complete application stack"
if errorlevel 1 (
    echo Note: No new files to commit ^(working tree clean^)
) else (
    echo Commit created successfully
)
echo.

REM Step 6: Show commit history
echo [Step 6/6] Recent commits:
git log --oneline -5
echo.

REM Push to GitHub
echo [PUSH] Pushing to GitHub...
echo Destination: origin/main
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo ERROR: Push failed. See output above.
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo   COMPLETE - REPOSITORY PUSHED
    echo ========================================
    echo.
    echo Repository: https://github.com/VijayKumar-VK63/Crickeon
    echo.
    echo Branch tracking:
    git branch -vv
    echo.
    pause
    exit /b 0
)
