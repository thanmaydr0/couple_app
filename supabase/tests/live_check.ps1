$ErrorActionPreference = 'Stop'
# Read local credentials without printing passwords, JWTs or TURN credentials.
# Run from repository root: pwsh -File supabase/tests/live_check.ps1
$credentialData = Get-Content -Raw -LiteralPath 'supabase/.private/account-credentials.json' | ConvertFrom-Json
$clientEnv = @{}
Get-Content -LiteralPath 'supabase/deployment/client.env' | ForEach-Object {
  $parts = $_ -split '=', 2
  if ($parts.Count -eq 2) { $clientEnv[$parts[0]] = $parts[1] }
}
$apiUrl = $clientEnv['EXPO_PUBLIC_SUPABASE_URL']
$publicKey = $clientEnv['EXPO_PUBLIC_SUPABASE_ANON_KEY']
$results = @()
$settings = Invoke-RestMethod -TimeoutSec 30 -Uri "$apiUrl/auth/v1/settings" -Headers @{ apikey = $publicKey }
if (-not $settings.disable_signup) { throw 'Public signups are still enabled' }
foreach ($account in $credentialData.accounts) {
  $login = @{ email = $account.email; password = $account.password } | ConvertTo-Json
  $session = Invoke-RestMethod -TimeoutSec 30 -Method Post -Uri "$apiUrl/auth/v1/token?grant_type=password" -Headers @{ apikey = $publicKey } -ContentType 'application/json' -Body $login
  $headers = @{ apikey = $publicKey; Authorization = "Bearer $($session.access_token)" }
  $profiles = Invoke-RestMethod -TimeoutSec 30 -Uri "$apiUrl/rest/v1/profiles?select=id,couple_id" -Headers $headers
  if ($profiles.Count -ne 2 -or -not $profiles[0].couple_id -or $profiles[0].couple_id -ne $profiles[1].couple_id) { throw 'Both profiles must share one couple' }
  $turn = Invoke-WebRequest -TimeoutSec 30 -Method Post -Uri "$apiUrl/functions/v1/turn-credentials" -Headers $headers -ContentType 'application/json' -Body '{}' -SkipHttpErrorCheck
  if ($turn.StatusCode -ne 200) { throw "TURN function returned HTTP $($turn.StatusCode)" }
  $iceServers = @($turn.Content | ConvertFrom-Json)
  $relayCount = @($iceServers | Where-Object { @($_.urls | Where-Object { $_ -match '^turns?:' }).Count -gt 0 }).Count
  if ($relayCount -lt 1) { throw 'TURN returned only STUN fallback; check Metered secrets and availability' }
  $notifyBody = @{ type = 'message'; title = 'Backend check'; body = 'No-token verification'; data = @{} } | ConvertTo-Json
  $notify = Invoke-WebRequest -TimeoutSec 30 -Method Post -Uri "$apiUrl/functions/v1/notify-partner" -Headers $headers -ContentType 'application/json' -Body $notifyBody -SkipHttpErrorCheck
  if ($notify.StatusCode -ne 200 -or -not ($notify.Content | ConvertFrom-Json).ok) { throw "Notify function returned HTTP $($notify.StatusCode)" }
  $results += @{ account_id = $account.id; sign_in = 'passed'; paired_profile_count = $profiles.Count; turn_http_status = [int]$turn.StatusCode; turn_relay_count = $relayCount; notify_no_token = 'passed' }
}
foreach ($functionName in @('turn-credentials', 'notify-partner')) {
  $unauth = Invoke-WebRequest -TimeoutSec 30 -Method Post -Uri "$apiUrl/functions/v1/$functionName" -Headers @{ apikey = $publicKey } -ContentType 'application/json' -Body '{}' -SkipHttpErrorCheck
  if ($unauth.StatusCode -ne 401) { throw "$functionName accepted a missing JWT" }
}
$report = @{ verified_at = [DateTimeOffset]::UtcNow.ToString('o'); project_ref = 'tlqedvktbgaipzhdgsuy'; signups_disabled = $settings.disable_signup; unauthenticated_functions = 'rejected'; accounts = $results }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath 'supabase/deployment/verification.json'
Write-Output 'Both accounts sign in and see exactly two paired profiles. Both functions return 200 for members and reject missing JWTs.'
Write-Output "TURN relay servers returned per account: $((@($results | ForEach-Object { $_.turn_relay_count })) -join ', ')"
Write-Output 'Sanitized results saved to supabase/deployment/verification.json'
