param(
  [string]$Version = "1.0.0",
  [switch]$Minify = $false
)

$srcDir = Join-Path $PSScriptRoot "src"
$distDir = Join-Path $PSScriptRoot "dist"

# Clean dist
if (Test-Path $distDir) { Remove-Item -Recurse -Force $distDir }
New-Item -ItemType Directory -Path $distDir | Out-Null

# Read source files
$htmlSrc = Join-Path $srcDir "index.html"
$contentSrc = Join-Path $srcDir "content.js"
$html = [System.IO.File]::ReadAllText($htmlSrc, [System.Text.Encoding]::UTF8)
$contentScript = [System.IO.File]::ReadAllText($contentSrc, [System.Text.Encoding]::UTF8)

# Step 1: Inline content.js (replace external script tag with inline script)
$inlined = $html -replace '<script src="content\.js"></script>', "<script>`n// content.js - generated $((Get-Date).ToString('yyyy-MM-dd'))`n$contentScript`n</script>"

# Step 2: Version injection — add as comment
$inlined = $inlined -replace '(<!--.*?-->)?\s*<html', "<!-- zimu-english v$Version -->`n<html"

# Step 4: Basic minification (optional)
if ($Minify) {
  Write-Host "Minifying..."
  $inlined = $inlined -replace '//.*?[\r\n]', "`n"          # Remove JS line comments (crude)
  $inlined = $inlined -replace '(?m)^\s+', ''               # Remove leading whitespace
  $inlined = $inlined -replace '(?m)\s+$', ''                # Remove trailing whitespace
  $inlined = $inlined -replace '\s{2,}', ' '                # Collapse spaces
  $inlined = $inlined -replace '>\s+<', '><'                # Remove whitespace between tags
}

# Write dist/index.html
$outPath = Join-Path $distDir "index.html"
[System.IO.File]::WriteAllText($outPath, $inlined, [System.Text.Encoding]::UTF8)

# Also copy content.js to dist (for non-inlined usage)
Copy-Item $contentSrc $distDir

# Copy PWA assets
Copy-Item (Join-Path $srcDir "manifest.json") $distDir
Copy-Item (Join-Path $srcDir "sw.js") $distDir
Copy-Item (Join-Path $srcDir "icon-192.svg") $distDir
Copy-Item (Join-Path $srcDir "icon-512.svg") $distDir

Write-Host "Build complete: $($(Get-Item $outPath).Length) bytes"
Write-Host "  $outPath"
Write-Host "  $(Join-Path $distDir 'content.js')"
