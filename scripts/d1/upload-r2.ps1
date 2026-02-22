param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDir,

  [Parameter(Mandatory = $false)]
  [string]$Bucket = "book365-files"
)

if (-not (Test-Path -LiteralPath $SourceDir)) {
  Write-Error "SourceDir does not exist: $SourceDir"
  exit 1
}

$resolved = (Resolve-Path -LiteralPath $SourceDir).Path
$files = Get-ChildItem -LiteralPath $resolved -File -Recurse

if (-not $files -or $files.Count -eq 0) {
  Write-Warning "No files found under: $resolved"
  exit 0
}

$ok = 0
$fail = 0

foreach ($file in $files) {
  $full = $file.FullName
  $relative = $full.Substring($resolved.Length).TrimStart('\', '/')
  $key = $relative -replace '\\', '/'
  $target = "$Bucket/$key"

  Write-Host "Uploading: $key"
  npx wrangler r2 object put $target --file "$full" | Out-Null

  if ($LASTEXITCODE -eq 0) {
    $ok++
  } else {
    $fail++
    Write-Warning "Failed: $key"
  }
}

Write-Host "Done. Uploaded: $ok, Failed: $fail"
if ($fail -gt 0) {
  exit 1
}

