Add-Type -AssemblyName System.IO.Compression.FileSystem
$apkPath = "C:\Users\Salat\Desktop\KenyaPay-v1.0.0.apk"
$zip = [System.IO.Compression.ZipFile]::OpenRead($apkPath)
Write-Host "Total entries in APK: $($zip.Entries.Count)"
$resEntries = $zip.Entries | Where-Object { $_.FullName -like "res/*" }
Write-Host "Res entries: $($resEntries.Count)"
$resEntries | Select-Object -First 20 | ForEach-Object { Write-Host "$($_.FullName) ($($_.Length) bytes)" }
$zip.Dispose()
