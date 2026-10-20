Add-Type -AssemblyName System.Drawing

function Generate-KenyaPayIcon([string]$path, [int]$size, [bool]$isRound = $false, [bool]$fgOnly = $false) {
    $bmp = [System.Drawing.Bitmap]::new($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $rect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)

    if (-not $fgOnly) {
        if ($isRound) {
            $pathClip = [System.Drawing.Drawing2D.GraphicsPath]::new()
            $pathClip.AddEllipse(0, 0, $size, $size)
            $g.SetClip($pathClip)
        }

        # Rich Royal Indigo gradient background
        $c1 = [System.Drawing.Color]::FromArgb(255, 79, 70, 229)  # #4f46e5
        $c2 = [System.Drawing.Color]::FromArgb(255, 49, 46, 129)  # #312e81
        $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $c1, $c2, 45.0)
        $g.FillRectangle($bgBrush, $rect)
        $bgBrush.Dispose()

        # Inner subtle gold shield/card
        $m = [int]($size * 0.08)
        $cardW = $size - ($m * 2)
        $cardRect = [System.Drawing.Rectangle]::new($m, $m, $cardW, $cardW)
        $goldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180, 245, 158, 11), [float]($size * 0.02))
        $cardPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $r = [int]($size * 0.2)
        $d = $r * 2
        $cardPath.AddArc($cardRect.X, $cardRect.Y, $d, $d, 180, 90)
        $cardPath.AddArc($cardRect.Right - $d, $cardRect.Y, $d, $d, 270, 90)
        $cardPath.AddArc($cardRect.Right - $d, $cardRect.Bottom - $d, $d, $d, 0, 90)
        $cardPath.AddArc($cardRect.X, $cardRect.Bottom - $d, $d, $d, 90, 90)
        $cardPath.CloseFigure()
        $g.DrawPath($goldPen, $cardPath)
        $goldPen.Dispose()
        $cardPath.Dispose()
    }

    # Center KP Monogram & Kenya Emerald Dot
    $fontSize = [float]($size * 0.38)
    $font = [System.Drawing.Font]::new("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $fmt = [System.Drawing.StringFormat]::new()
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Drop shadow for KP
    $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(100, 0, 0, 0))
    $g.DrawString("KP", $font, $shadowBrush, [float]($size * 0.5 + ($size * 0.015)), [float]($size * 0.48 + ($size * 0.015)), $fmt)
    $shadowBrush.Dispose()

    # Pure White text
    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $g.DrawString("KP", $font, $whiteBrush, [float]($size * 0.5), [float]($size * 0.48), $fmt)
    $whiteBrush.Dispose()
    $font.Dispose()
    $fmt.Dispose()

    # Kenya Emerald Accent Dot (Represents Live M-Pesa / Rails)
    $dotSize = [int]($size * 0.12)
    $dotX = [int]($size * 0.72)
    $dotY = [int]($size * 0.28)
    $dotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 16, 185, 129)) # #10b981
    $g.FillEllipse($dotBrush, $dotX, $dotY, $dotSize, $dotSize)
    $dotBrush.Dispose()

    $dotBorder = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 255, 255), [float]($size * 0.025))
    $g.DrawEllipse($dotBorder, $dotX, $dotY, $dotSize, $dotSize)
    $dotBorder.Dispose()

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $path ($size x $size)"
}

$assetsDir = "C:\Users\Salat\.gemini\antigravity\scratch\kenyan-payment-platform\mobile\assets"
Generate-KenyaPayIcon "$assetsDir\icon.png" 1024 $false $false
Generate-KenyaPayIcon "$assetsDir\adaptive-icon.png" 1024 $false $true

$resDir = "C:\Users\Salat\.gemini\antigravity\scratch\kenyan-payment-platform\mobile\android\app\src\main\res"
$mipmaps = @{
    'mipmap-mdpi'    = @{ l = 48;  fg = 108 }
    'mipmap-hdpi'    = @{ l = 72;  fg = 162 }
    'mipmap-xhdpi'   = @{ l = 96;  fg = 216 }
    'mipmap-xxhdpi'  = @{ l = 144; fg = 324 }
    'mipmap-xxxhdpi' = @{ l = 192; fg = 432 }
}

foreach ($m in $mipmaps.GetEnumerator()) {
    $dir = "$resDir\$($m.Key)"
    if (Test-Path $dir) {
        Generate-KenyaPayIcon "$dir\ic_launcher.png" $m.Value.l $false $false
        Generate-KenyaPayIcon "$dir\ic_launcher_round.png" $m.Value.l $true $false
        Generate-KenyaPayIcon "$dir\ic_launcher_foreground.png" $m.Value.fg $false $true
    }
}
Write-Host "ALL ICONS GENERATED SUCCESSFULLY!"
