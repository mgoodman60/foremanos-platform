# PowerShell script to hand off work to another agent
# Usage: .\scripts\handoff-to-agent.ps1 <agent-name>
# Example: .\scripts\handoff-to-agent.ps1 codex

param(
    [Parameter(Mandatory=$true)]
    [string]$AgentName
)

Write-Host "🔄 Generating task files for $AgentName..." -ForegroundColor Cyan

# Generate task files
node scripts/generate-agent-tasks.js $AgentName

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Task files generated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Generated files:" -ForegroundColor Yellow
    Write-Host "   - $($AgentName.ToUpper())_QUICK_START.md" -ForegroundColor White
    Write-Host "   - $($AgentName.ToUpper())_TASKS.md" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Next step: Give $AgentName this prompt:" -ForegroundColor Cyan
    Write-Host "   'Read and complete tasks in $($AgentName.ToUpper())_QUICK_START.md'" -ForegroundColor White
} else {
    Write-Host "❌ Failed to generate task files" -ForegroundColor Red
    Write-Host "   Check that .workflow-status.json has work assigned to $AgentName" -ForegroundColor Yellow
}
