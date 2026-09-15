param(
  [string]$BaseUrl = "http://localhost:3000",
  [Parameter(Mandatory = $true)]
  [string]$Cookie,
  [string]$PistonUrl = "http://localhost:2000/api/v2",
  [int]$Limit = 3,
  [switch]$SkipPistonSetup
)

# 未検証のお題（is_verified=false）を POST /api/problems/verify で順に検証する。
# 1 件の検証はセーフ行の算出（1 行ずつ削除して Piston で実行）を含み時間がかかるため、
# 1 リクエストあたり $Limit 件に絞り、レスポンスの nextAfter をカーソルにして残りが無くなるまで繰り返す。
# 却下されたお題は is_verified=false のまま残るが、カーソルで飛ばすので同じ実行内で再処理しない。

if (-not $SkipPistonSetup) {
  docker compose -f (Join-Path $PSScriptRoot "..\piston\docker-compose.yml") up -d
  Start-Sleep -Seconds 2
  $runtime = Invoke-RestMethod -Method Get -Uri "$($PistonUrl.TrimEnd('/'))/runtimes"
  if (-not ($runtime | Where-Object { $_.language -eq "deno" })) {
    Invoke-RestMethod -Method Post -Uri "$($PistonUrl.TrimEnd('/'))/packages" -ContentType "application/json" -Body '{"language":"deno","version":"1.32.3"}'
  }
}

$endpoint = "$($BaseUrl.TrimEnd('/'))/api/problems/verify"
$after = $null
$round = 0
$totalVerified = 0
$totalRejected = 0

while ($true) {
  $round += 1
  $uri = "${endpoint}?limit=$Limit"
  if ($after) { $uri += "&after=$after" }

  Write-Host "[round $round] POST $uri"
  # サーバー側のレート制限（同一ユーザーは 1 分に 1 回）に当たったら待って同じラウンドをやり直す。
  $response = $null
  while ($true) {
    try {
      $response = Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Cookie = $Cookie }
      break
    } catch {
      $body = [string]$_.ErrorDetails.Message
      # 本文は生の日本語でも \uXXXX エスケープでも返りうるので両方を見る。
      $rateLimited = $body.Contains('1分に1回') -or $body.Contains('1\u5206\u306B1\u56DE')
      if ($rateLimited) {
        Write-Host "  レート制限のため 60 秒待ちます..."
        Start-Sleep -Seconds 60
        continue
      }
      throw
    }
  }
  $data = $response.data
  if (-not $data) {
    Write-Host "レスポンスに data がありません:"
    $response | ConvertTo-Json -Depth 10
    exit 1
  }

  foreach ($v in $data.verified) {
    Write-Host "  verified  $($v.problemId)  (セーフ行 $($v.safeLineCount) 行)"
    $totalVerified += 1
  }
  foreach ($r in $data.rejected) {
    Write-Host "  rejected  $($r.problemId)  $($r.reason)"
    $totalRejected += 1
  }

  if (-not $data.nextAfter -or $data.remaining -le 0) { break }
  $after = $data.nextAfter
}

Write-Host ""
Write-Host "完了: verified=$totalVerified rejected=$totalRejected"
