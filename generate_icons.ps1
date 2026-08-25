Add-Type -AssemblyName System.Drawing

$iconDir = "D:\1-dev\dev-miid\optimasi browser\ram-lifesaver-extension\icons"
if (-not (Test-Path $iconDir)) {
    New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
}

$sizes = @(16, 48, 128)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    
    # Background gradient
    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 255, 94, 58),
        [System.Drawing.Color]::FromArgb(255, 255, 42, 84),
        45.0
    )
    
    # Rounded corners / circle
    $g.FillEllipse($brush, 1, 1, ($size - 2), ($size - 2))
    
    # Draw lightning bolt symbol
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.0, $size / 10.0))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    
    $p1 = New-Object System.Drawing.PointF ($size * 0.55), ($size * 0.20)
    $p2 = New-Object System.Drawing.PointF ($size * 0.35), ($size * 0.52)
    $p3 = New-Object System.Drawing.PointF ($size * 0.52), ($size * 0.52)
    $p4 = New-Object System.Drawing.PointF ($size * 0.42), ($size * 0.80)
    $p5 = New-Object System.Drawing.PointF ($size * 0.68), ($size * 0.45)
    $p6 = New-Object System.Drawing.PointF ($size * 0.50), ($size * 0.45)
    
    $points = [System.Drawing.PointF[]]@($p1, $p2, $p3, $p4, $p5, $p6)
    $fillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillPolygon($fillBrush, $points)
    
    $outPath = Join-Path $iconDir "icon$size.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $outPath"
}
