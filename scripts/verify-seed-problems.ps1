param(
  [string]$BaseUrl = "http://localhost:3000",
  [Parameter(Mandatory = $true)]
  [string]$Cookie,
  [string]$PistonUrl = "http://localhost:2000/api/v2",
  [switch]$SkipPistonSetup
)

if (-not $SkipPistonSetup) {
  docker compose -f (Join-Path $PSScriptRoot "..\piston\docker-compose.yml") up -d
  Start-Sleep -Seconds 2
  $runtime = Invoke-RestMethod -Method Get -Uri "$($PistonUrl.TrimEnd('/'))/runtimes"
  if (-not ($runtime | Where-Object { $_.language -eq "deno" })) {
    Invoke-RestMethod -Method Post -Uri "$($PistonUrl.TrimEnd('/'))/packages" -ContentType "application/json" -Body '{"language":"deno","version":"1.32.3"}'
  }
}

$endpoint = "$($BaseUrl.TrimEnd('/'))/api/problems/verify"
$response = Invoke-RestMethod -Method Post -Uri $endpoint -Headers @{ Cookie = $Cookie }
$response | ConvertTo-Json -Depth 10
