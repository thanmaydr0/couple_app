$ErrorActionPreference = 'Stop'
# Run at the repository root. Credentials and tokens are never printed.
# Read-only REST checks; the SQL fixture provides rolled-back mutation assertions.
$locationAccounts = Get-Content -LiteralPath 'supabase/.private/account-credentials.json' -Raw | ConvertFrom-Json
$locationEnv = @{}
Get-Content -LiteralPath '.env' | ForEach-Object {
  $locationParts = $_ -split '=', 2
  if ($locationParts.Count -eq 2) { $locationEnv[$locationParts[0]] = $locationParts[1].Trim('"', "'") }
}
$locationUrl = $locationEnv['EXPO_PUBLIC_SUPABASE_URL']
$locationAnon = $locationEnv['EXPO_PUBLIC_SUPABASE_ANON_KEY']
if (-not $locationUrl -or -not $locationAnon) { throw 'Public Supabase configuration is missing' }
foreach ($locationAccount in $locationAccounts.accounts) {
  $locationLogin = @{ email = $locationAccount.email; password = $locationAccount.password } | ConvertTo-Json
  $locationSession = Invoke-RestMethod -TimeoutSec 20 -Method Post -Uri "$locationUrl/auth/v1/token?grant_type=password" -Headers @{ apikey = $locationAnon } -ContentType 'application/json' -Body $locationLogin
  $locationHeaders = @{ apikey = $locationAnon; Authorization = "Bearer $($locationSession.access_token)" }
  foreach ($locationTable in @('locations', 'journeys', 'saved_places')) {
    $locationResponse = Invoke-WebRequest -TimeoutSec 20 -Uri "$locationUrl/rest/v1/${locationTable}?select=*&limit=1" -Headers $locationHeaders -SkipHttpErrorCheck
    if ($locationResponse.StatusCode -ne 200) { throw "Authenticated $locationTable read failed: HTTP $($locationResponse.StatusCode)" }
  }
}
$locationAnonymous = Invoke-WebRequest -TimeoutSec 20 -Uri "$locationUrl/rest/v1/locations?select=user_id" -Headers @{ apikey = $locationAnon } -SkipHttpErrorCheck
if ($locationAnonymous.StatusCode -notin @(401,403)) { throw 'Anonymous location read was not denied' }
$locationGeocoding = Invoke-RestMethod -TimeoutSec 20 -Uri 'https://geocoding-api.open-meteo.com/v1/search?name=Berlin&count=1&language=en&format=json'
if (-not $locationGeocoding.results -or $null -eq $locationGeocoding.results[0].latitude) { throw 'Open-Meteo geocoding response failed validation' }
Write-Output 'PASS: both paired accounts can read all three location tables; anonymous access denied; Open-Meteo geocoding reachable. No locations written or notifications sent.'
