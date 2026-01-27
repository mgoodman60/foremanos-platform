# Git Wrapper Script - Auto-updates workflow status
# Usage: .\scripts\git-wrapper.ps1 <git-command> [args...]

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Command,
    
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

# Run the actual git command
$gitArgs = $Args -join ' '
$fullCommand = "git $Command $gitArgs"
Invoke-Expression $fullCommand

$exitCode = $LASTEXITCODE

# Auto-update workflow status based on command
if ($Command -eq 'commit' -and $exitCode -eq 0) {
    Write-Host "`n🔄 Updating workflow status..." -ForegroundColor Cyan
    node scripts/update-workflow-status.js commit
}

if ($Command -eq 'push' -and $exitCode -eq 0) {
    Write-Host "`n🔄 Updating deployment status..." -ForegroundColor Cyan
    node scripts/update-workflow-status.js push
}

exit $exitCode
