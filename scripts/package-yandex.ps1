$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$buildPath = Join-Path $workspacePath 'dist-yandex'
if (!(Test-Path -LiteralPath (Join-Path $buildPath 'index.html'))) { throw 'Run build:yandex first' }
$artifactPath = Join-Path $workspacePath 'artifacts'
New-Item -ItemType Directory -Path $artifactPath -Force | Out-Null
$zipPath = Join-Path $artifactPath 'osvobodi-pole-slice-yandex.zip'
Add-Type -AssemblyName System.IO.Compression
$zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in Get-ChildItem -LiteralPath $buildPath -File -Recurse) {
        # ZIP paths use forward slashes even when the build runs on Windows.
        $entryName = $file.FullName.Substring($buildPath.Length + 1).Replace('\', '/')
        $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $sourceStream = $file.OpenRead()
        try {
            $entryStream = $entry.Open()
            try { $sourceStream.CopyTo($entryStream) } finally { $entryStream.Dispose() }
        } finally { $sourceStream.Dispose() }
    }
} finally { $archive.Dispose(); $zipStream.Dispose() }
Get-Item -LiteralPath $zipPath | Select-Object FullName, Length
$hashBytes = [System.Security.Cryptography.SHA256]::Create().ComputeHash([System.IO.File]::ReadAllBytes($zipPath))
[System.BitConverter]::ToString($hashBytes).Replace('-', '').ToLowerInvariant()
