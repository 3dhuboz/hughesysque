# Hughesys Que — Production Deploy
# Usage: .\deploy.ps1
# Commits any pending changes to master, then pushes to the deploy branch
# which triggers exactly one Cloudflare Pages production build.

$ErrorActionPreference = "Stop"

Write-Host "`n🔥 Hughesys Que — Deploy to Production" -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

# Stage and commit any uncommitted changes
$status = git status --porcelain
if ($status) {
    $msg = Read-Host "`nUncommitted changes found. Enter a commit message (or press Enter for default)"
    if (-not $msg) { $msg = "deploy: wrap up changes" }
    git add -A
    git commit -m $msg
    Write-Host "✔ Committed: $msg" -ForegroundColor Green
} else {
    Write-Host "✔ No uncommitted changes." -ForegroundColor Green
}

# Push master
Write-Host "`nPushing master..." -ForegroundColor Cyan
git push origin master
Write-Host "✔ master pushed." -ForegroundColor Green

# Push master → deploy (triggers Cloudflare Pages build)
Write-Host "`nTriggering Cloudflare Pages deploy..." -ForegroundColor Cyan
git push origin master:deploy --force
Write-Host "✔ Deploy triggered! One build queued on Cloudflare Pages." -ForegroundColor Green

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🚀 Done — check https://dash.cloudflare.com for build status.`n" -ForegroundColor Yellow
