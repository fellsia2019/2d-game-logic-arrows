$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$buildPath = Join-Path $workspacePath 'dist-yandex'
if (!(Test-Path -LiteralPath (Join-Path $buildPath 'index.html'))) { throw 'Run build:yandex first' }
$artifactPath = Join-Path $workspacePath 'artifacts'
New-Item -ItemType Directory -Path $artifactPath -Force | Out-Null
$zipPath = Join-Path $artifactPath 'osvobodi-pole-slice-yandex.zip'
Compress-Archive -Path (Join-Path $buildPath '*') -DestinationPath $zipPath -Force
Get-Item -LiteralPath $zipPath | Select-Object FullName, Length
$hashBytes = [System.Security.Cryptography.SHA256]::Create().ComputeHash([System.IO.File]::ReadAllBytes($zipPath))
[System.BitConverter]::ToString($hashBytes).Replace('-', '').ToLowerInvariant()
