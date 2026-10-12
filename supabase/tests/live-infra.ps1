$ErrorActionPreference = 'Stop'
# Credential material is never printed and no notification is sent. Only invalid
# payloads are submitted after authenticating, before any partner-token lookup.
$credentials = Get-Content -LiteralPath 'supabase/.private/account-credentials.json' -Raw | ConvertFrom-Json
$clientEnv = @{}
Get-Content -LiteralPath 'supabase/deployment/client.env' | ForEach-Object { $parts = $_ -split '=',2; if ($parts.Count -eq 2) { $clientEnv[$parts[0]] = $parts[1] } }
$url = $clientEnv['EXPO_PUBLIC_SUPABASE_URL']; $key = $clientEnv['EXPO_PUBLIC_SUPABASE_ANON_KEY']
foreach ($account in $credentials.accounts) {
    $body = @{email=$account.email;password=$account.password} | ConvertTo-Json
    $session = Invoke-RestMethod -Method Post -Uri "$url/auth/v1/token?grant_type=password" -Headers @{apikey=$key} -ContentType 'application/json' -Body $body
    $headers = @{apikey=$key;Authorization="Bearer $($session.access_token)"}
    $rows = Invoke-RestMethod -Uri "$url/rest/v1/profiles?select=birthday,city,lat,lon,timezone,privacy" -Headers $headers
    if ($rows.Count -ne 2) { throw 'Profile scope regression' }
    $jobs = Invoke-WebRequest -Uri "$url/rest/v1/scheduled_jobs?select=id&limit=1" -Headers $headers -SkipHttpErrorCheck
    if ($jobs.StatusCode -ne 200) { throw 'Scheduled job API access failed' }
    foreach ($payload in @(
        @{channel='invalid';title='Validation';body='Validation';data=@{route='/us/plans'}},
        @{channel='plans';title='Validation';body='Validation';data=@{route='https://invalid.example'}}
    )) {
        $result = Invoke-WebRequest -Method Post -Uri "$url/functions/v1/notify-partner" -Headers $headers -ContentType 'application/json' -Body ($payload | ConvertTo-Json) -SkipHttpErrorCheck
        if ($result.StatusCode -ne 400) { throw "Notification validation failed: HTTP $($result.StatusCode)" }
    }
}
Write-Output 'Both existing accounts: profile columns and scheduled-job API accessible; invalid notification payloads rejected. No push sent.'
