Add-Type -AssemblyName System.Drawing

function Create-MasterIcon {
    param([string]$outputPath, [bool]$transparentBg = $false)

    $size = 1024
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    if (-not $transparentBg) {
        # Base deep dark background
        $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
        $cTop = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)    # #0f172a slate-900
        $cBottom = [System.Drawing.Color]::FromArgb(255, 30, 27, 75) # #1e1b4b indigo-950
        $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 45.0)
        $g.FillRectangle($bgBrush, $rect)
        $bgBrush.Dispose()

        # Rounded badge card in center
        $cardMargin = 72
        $cardSize = $size - ($cardMargin * 2)
        $cardRect = New-Object System.Drawing.Rectangle($cardMargin, $cardMargin, $cardSize, $cardSize)
        $cCard1 = [System.Drawing.Color]::FromArgb(255, 67, 56, 202)  # #4338ca
        $cCard2 = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)  # #2563eb
        $cardBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($cardRect, $cCard1, $cCard2, 60.0)

        # Draw rounded rect path
        $radius = 180
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $path.AddArc($cardRect.X, $cardRect.Y, $d, $d, 180, 90)
        $path.AddArc($cardRect.Right - $d, $cardRect.Y, $d, $d, 270, 90)
        $path.AddArc($cardRect.Right - $d, $cardRect.Bottom - $d, $d, $d, 0, 90)
        $path.AddArc($cardRect.X, $cardRect.Bottom - $d, $d, $d, 90, 90)
        $path.CloseFigure()

        $g.FillPath($cardBrush, $path)

        # Luxury gold/emerald border
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 245, 158, 11), 8) # amber-500
        $g.DrawPath($borderPen, $path)
        $borderPen.Dispose()
        $cardBrush.Dispose()
        $path.Dispose()
    }

    # Center Emblem: Stylized Shield / Wallet & "KP"
    # Golden glow circle in middle
    $center = $size / 2
    $glowSize = 460
    $glowRect = New-Object System.Drawing.Rectangle(($center - $glowSize/2), ($center - $glowSize/2 - 30), $glowSize, $glowSize)
    $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 255, 255, 255))
    $g.FillEllipse($glowBrush, $glowRect)
    $glowBrush.Dispose()

    # Draw Shield Symbol
    $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $topY = $center - 190
    $botY = $center + 120
    $midX = $center
    $w = 170

    $shieldPath.AddLine($midX - $w, $topY, $midX + $w, $topY)
    $shieldPath.AddLine($midX + $w, $topY, $midX + $w, $topY + 110)
    $shieldPath.AddBezier($midX + $w, $topY + 110, $midX + $w, $botY - 30, $midX, $botY + 70, $midX, $botY + 70)
    $shieldPath.AddBezier($midX, $botY + 70, $midX, $botY - 30, $midX - $w, $topY + 110, $midX - $w, $topY + 110)
    $shieldPath.CloseFigure()

    # Fill Shield with subtle dark gradient
    $sBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Rectangle($midX - $w, $topY, $w * 2, ($botY - $topY + 70))),
        [System.Drawing.Color]::FromArgb(240, 15, 23, 42),
        [System.Drawing.Color]::FromArgb(240, 30, 27, 75),
        90.0
    )
    $g.FillPath($sBrush, $shieldPath)
    $sBrush.Dispose()

    # Shield golden border
    $sPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 245, 158, 11), 14)
    $g.DrawPath($sPen, $shieldPath)
    $sPen.Dispose()
    $shieldPath.Dispose()

    # Draw "KP" Typography inside shield
    $font = New-Object System.Drawing.Font("Arial", 160, [System.Drawing.FontStyle]::Bold)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Text shadow
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 0, 0, 0))
    $g.DrawString("KP", $font, $shadowBrush, [float]($midX + 4), [float]($center - 50 + 4), $format)
    $shadowBrush.Dispose()

    # Text gradient (Pure white to pale emerald)
    $textBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Rectangle($midX - 150, $center - 150, 300, 200)),
        [System.Drawing.Color]::FromArgb(255, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(255, 209, 250, 229), # emerald-100
        90.0
    )
    $g.DrawString("KP", $font, $textBrush, [float]$midX, [float]($center - 50), $format)
    $textBrush.Dispose()

    # Draw "KENYAPAY" Banner below shield
    if (-not $transparentBg) {
        $subFont = New-Object System.Drawing.Font("Arial", 52, [System.Drawing.FontStyle]::Bold)
        $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 251, 191, 36)) # amber-400
        $g.DrawString("KENYAPAY", $subFont, $subBrush, [float]$midX, [float]($size - 170), $format)
        $subFont.Dispose()
        $subBrush.Dispose()
    }

    $font.Dispose()
    $format.Dispose()
    $g.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: $outputPath"
}

# Create base master icons
$assetsDir = "C:\Users\Salat\.gemini\antigravity\scratch\kenyan-payment-platform\mobile\assets"
Create-MasterIcon "$assetsDir\icon.png" $false
Create-MasterIcon "$assetsDir\adaptive-icon.png" $true

# Now generate resized icons for Android mipmaps
$resDir = "C:\Users\Salat\.gemini\antigravity\scratch\kenyan-payment-platform\mobile\android\app\src\main\res"

$sizes = @{
    'mipmap-mdpi'    = @{ launcher = 48;  fg = 108 }
    'mipmap-hdpi'    = @{ launcher = 72;  fg = 162 }
    'mipmap-xhdpi'   = @{ launcher = 96;  fg = 216 }
    'mipmap-xxhdpi'  = @{ launcher = 144; fg = 324 }
    'mipmap-xxxhdpi' = @{ launcher = 192; fg = 432 }
}

$masterFull = [System.Drawing.Bitmap]::FromFile("$assetsDir\icon.png")
$masterFg   = [System.Drawing.Bitmap]::FromFile("$assetsDir\adaptive-icon.png")

function Resize-Bitmap($srcBmp, [int]$w, [int]$h, [bool]$isRound = $false) {
    $dest = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($isRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $w, $h)
        $g.SetClip($path)
        $g.DrawImage($srcBmp, 0, 0, $w, $h)
        $path.Dispose()
    } else {
        $g.DrawImage($srcBmp, 0, 0, $w, $h)
    }

    $g.Dispose()
    return $dest
}

foreach ($item in $sizes.GetEnumerator()) {
    $folder = $item.Key
    $lSize  = $item.Value.launcher
    $fgSize = $item.Value.fg
    $targetDir = "$resDir\$folder"

    if (Test-Path $targetDir) {
        # 1. ic_launcher.png
        $img1 = Resize-Bitmap $masterFull $lSize $lSize $false
        $img1.Save("$targetDir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
        $img1.Dispose()

        # 2. ic_launcher_round.png
        $img2 = Resize-Bitmap $masterFull $lSize $lSize $true
        $img2.Save("$targetDir\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
        $img2.Dispose()

        # 3. ic_launcher_foreground.png
        $img3 = Resize-Bitmap $masterFg $fgSize $fgSize $false
        $img3.Save("$targetDir\ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
        $img3.Dispose()

        Write-Host "Updated mipmap: $folder (launcher: ${lSize}px, fg: ${fgSize}px)"
    }
}

$masterFull.Dispose()
$masterFg.Dispose()
Write-Host "SUCCESS: All KenyaPay phone launcher icons generated!"
