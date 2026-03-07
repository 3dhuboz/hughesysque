# Hughesys Que — Production Deploy
# Usage: .\deploy.ps1
# Commits any pending changes to master, then pushes to the deploy branch
# which triggers exactly one Cloudflare Pages production build.

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "== Hughesys Que: Deploy to Production ==" -ForegroundColor Red
Write-Host "----------------------------------------" -ForegroundColor DarkGray

# Stage and commit any uncommitted changes
$status = git status --porcelain
if ($status) {
    $msg = Read-Host "Uncommitted changes found. Enter a commit message (or press Enter for default)"
    if (-not $msg) { $msg = "deploy: wrap up changes" }
    git add -A
    git commit -m $msg
    Write-Host "OK: Committed: $msg" -ForegroundColor Green
} else {
    Write-Host "OK: No uncommitted changes." -ForegroundColor Green
}

# Push master
Write-Host "Pushing master..." -ForegroundColor Cyan
git push origin master
Write-Host "OK: master pushed." -ForegroundColor Green

# Push master to deploy (triggers Cloudflare Pages build)
Write-Host "Triggering Cloudflare Pages deploy..." -ForegroundColor Cyan
git push origin master:deploy --force
Write-Host "OK: Deploy triggered! One build queued on Cloudflare Pages." -ForegroundColor Green

Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host "Done. Check https://dash.cloudflare.com for build status." -ForegroundColor Yellow
Write-Host ""
