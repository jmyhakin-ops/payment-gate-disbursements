Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('C:\Users\Salat\Desktop\KenyaPay-v1.0.0.apk')
$entry = $zip.GetEntry('assets/index.android.bundle')
if ($entry -ne $null) {
    $stream = $entry.Open()
    $buf = New-Object byte[] 64
    $read = $stream.Read($buf, 0, 64)
    $stream.Close()
    Write-Host "Read $read bytes"
    $hex = [BitConverter]::ToString($buf)
    Write-Host "Hex: $hex"
    $txt = [System.Text.Encoding]::UTF8.GetString($buf)
    Write-Host "Text preview: $txt"
} else {
    Write-Host "Entry assets/index.android.bundle NOT FOUND!"
}
$zip.Dispose()
