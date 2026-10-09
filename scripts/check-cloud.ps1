param([Parameter(Mandatory=$true)][string]$ProjectRef,
      [Parameter(Mandatory=$true)][string]$PublishableKey)
$base = "https://$ProjectRef.supabase.co"
Write-Host "Checking Home Thames Cloud Auth: $base"
try {
  $res = Invoke-RestMethod -Uri "$base/auth/v1/health" -Headers @{apikey=$PublishableKey} -Method Get -TimeoutSec 15
  Write-Host "Auth server reachable. Next: run SQL migrations, deploy Edge Functions and create an account." -ForegroundColor Green
} catch {
  Write-Host "Not ready: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
