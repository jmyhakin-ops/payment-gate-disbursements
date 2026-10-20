Add-Type -AssemblyName System.IO.Compression.FileSystem
$apkPath = "C:\Users\Salat\Desktop\KenyaPay-v1.0.0.apk"
$zip = [System.IO.Compression.ZipFile]::OpenRead($apkPath)
Write-Host "Total entries in APK: $($zip.Entries.Count)"
foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "*ic_launcher*" -or $entry.FullName -like "*bundle*") {
        Write-Host "$($entry.FullName) ($($entry.Length) bytes)"
    }
}
$zip.Dispose()
