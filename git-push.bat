@echo off
setlocal enabledelayedexpansion

cd /d c:\Users\kotha\VK\Crickeon

REM Disable Git pager
git config core.pager ""

REM Try to abort any in-progress rebase
git rebase --abort 2>nul

REM Check current status
echo === GIT STATUS ===
git status --short

REM Check remotes
echo === REMOTES ===
git remote -v

REM Check branch
echo === BRANCH ===
git branch -v

REM Log last 5 commits
echo === RECENT COMMITS ===
git log --oneline -5

REM Try to push
echo === PUSHING TO GITHUB ===
git push -u origin main
