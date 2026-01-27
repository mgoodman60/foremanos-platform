# Git Push Script - Bypasses proxy issues and handles authentication
# Usage: .\git-push.ps1 [branch-name] [token]
# First time: .\git-push.ps1 main "your-token-here"
# After that: .\git-push.ps1

param(
    [string]$Branch = "main",
    [string]$Token = ""
)

# Unset proxy environment variables
$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:http_proxy = $null
$env:https_proxy = $null

# If token provided, use it in URL
if ($Token) {
    $remoteUrl = "https://mgoodman60:$Token@github.com/mgoodman60/foremanos.git"
    Write-Host "Pushing with token..." -ForegroundColor Yellow
    git -c http.proxy= -c https.proxy= push $remoteUrl $Branch
} else {
    # Try normal push (credentials should be cached)
    Write-Host "Pushing (using cached credentials)..." -ForegroundColor Yellow
    git -c http.proxy= -c https.proxy= push origin $Branch
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully pushed to origin/$Branch" -ForegroundColor Green
} else {
    Write-Host "❌ Push failed." -ForegroundColor Red
    Write-Host "If this is your first push, run: .\git-push.ps1 $Branch `"your-token`"" -ForegroundColor Yellow
}
