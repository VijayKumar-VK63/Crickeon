#!/usr/bin/env pwsh
<#
 .DESCRIPTION
    Complete Git commit and push workflow for Crickeon repository
#>

param([switch]$DryRun = $false)

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CRICKEON FINAL COMMIT & PUSH"       -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Set pager to none
Write-Host "`n[1/6] Configuring Git..."
& git config core.pager ""
& git config advice.waitingForEditor false
Write-Host "  ✓ Git pager disabled"

# Check current status
Write-Host "`n[2/6] Checking current state..."
Write-Host "  Status:"
& git status --porcelain
Write-Host "  Branch:"
& git branch -v
Write-Host "  Remote:"
& git remote -v

# Stage all files
Write-Host "`n[3/6] Staging all changes..."
& git add -A
Write-Host "  ✓ All files staged"

# Verify staged files
Write-Host "`n[4/6] Verifying staged files..."
$stagedCount = (& git diff --cached --name-only | Measure-Object).Count
Write-Host "  $stagedCount files staged for commit"

if ($stagedCount -eq 0) {
    Write-Host "  WARNING: No files to commit. Working tree is clean."
    Write-Host "  Existing commits will be pushed instead."
} else {
    Write-Host "`n[5/6] Creating commit..."
    
    if ($DryRun) {
        Write-Host "  [DRY RUN] Would commit $stagedCount files"
    } else {
        $commitMessage = "feat: production-ready monorepo with namespace corrections and documentation"
        
        # Create commit
        & git commit -m $commitMessage
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Commit created"
        } else {
            Write-Host "  ! Empty commit - no changes to record"
        }
    }
}

# Show commit log
Write-Host "`n[6/6] Recent commits:"
& git log --oneline -5

# Push to GitHub
Write-Host "`n[PUSH] Pushing to GitHub..."
Write-Host "  Destination: origin/main"

if (-not $DryRun) {
    $pushOutput = & git push -u origin main 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Push successful!" -ForegroundColor Green
        Write-Host "`n  Tracking:"
        & git branch -vv
    } else {
        Write-Host "  ✗ Push failed:" -ForegroundColor Red
        Write-Host $pushOutput
        exit 1
    }
} else {
    Write-Host "  [DRY RUN] Would push to origin/main"
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  ✓ COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nRepository pushed to:"
Write-Host "  https://github.com/VijayKumar-VK63/Crickeon"
