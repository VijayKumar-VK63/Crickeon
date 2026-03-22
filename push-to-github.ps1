#!/usr/bin/env pwsh
# Git Push Complete Workflow
# This script handles the complete git push to GitHub

param([switch]$SkipRebaseCleanup = $false)

$ErrorActionPreference = "Continue"

# Step 0: Cleanup any broken rebase state
if (-not $SkipRebaseCleanup) {
    Write-Host "Cleaning up incomplete rebase state..."
    if (Test-Path ".git/rebase-merge") {
        Remove-Item -Force -Recurse ".git/rebase-merge" 
        Write-Host "  ✓ Removed rebase-merge directory"
    }
    Get-ChildItem ".git" -Filter "COMMIT_EDITMSG*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Cleaned up editor artifacts"
}

# Step 1: Verify current state
Write-Host "`n=== STEP 1: VERIFY GIT STATE ==="
$currentBranch = & git rev-parse --abbrev-ref HEAD 2>&1
$remoteUrl = & git config --get remote.origin.url 2>&1
Write-Host "  Branch: $currentBranch"
Write-Host "  Remote: $remoteUrl"

# Step 2: Ensure main branch  
Write-Host "`n=== STEP 2: ENSURE MAIN BRANCH ==="
if ($currentBranch -ne "main") {
    Write-Host "  Renaming branch to 'main'..."
    & git branch -M main 2>&1
    Write-Host "  ✓ Branch renamed to main"
} else {
    Write-Host "  ✓ Already on main branch"
}

# Step 3: Check for staged changes
Write-Host "`n=== STEP 3: CHECK WORKING TREE ==="
$statusOutput = & git status --short 2>&1
if (-not $statusOutput -or $statusOutput -eq "") {
    Write-Host "  ✓ Working tree is clean (no staged changes)"
} else {
    Write-Host "  Staged changes found, showing status..."
    Write-Host $statusOutput
}

# Step 4: Verify remote 
Write-Host "`n=== STEP 4: VERIFY REMOTE ==="
$remotes = & git remote -v 2>&1
if ($remotes) {
    Write-Host "  Configured remotes:"
    Write-Host $remotes
} else {
    Write-Host "  No remote found - adding origin..."
    & git remote add origin https://github.com/VijayKumar-VK63/Crickeon.git 2>&1
    Write-Host "  ✓ Added origin remote"
}

# Step 5: Check if remote has content
Write-Host "`n=== STEP 5: FETCH FROM REMOTE ==="
Write-Host "  Fetching from origin..."
& git fetch origin 2>&1 | Select-Object -First 10
Write-Host "  ✓ Fetch complete"

# Step 6: Check commit history
Write-Host "`n=== STEP 6: COMMIT HISTORY ==="
Write-Host "  Last 5 commits:"
& git log --oneline -5 2>&1

# Step 7: Safe Push
Write-Host "`n=== STEP 7: PUSH TO GITHUB ==="
Write-Host "  Pushing main to origin/main..."

# Try regular push first
$pushResult = & git push -u origin main 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Push successful!"
    Write-Host $pushResult
} else {
    Write-Host "  Push output:"
    Write-Host $pushResult
    Write-Host "  ✗ Push failed with exit code: $LASTEXITCODE"
}

# Step 8: Final verification
Write-Host "`n=== STEP 8: POST-PUSH VERIFICATION ==="
Write-Host "  Checking remote status..."
& git branch -vv 2>&1
Write-Host "`n  ✓ Complete!"
