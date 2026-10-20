@echo off
echo ================================================
echo  KenyaPay Mobile - Local Release APK Build
echo ================================================
echo.

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=C:\Users\Salat\AppData\Local\Android\Sdk"

cd /d "%~dp0android"

echo [1/2] Checking environment...
echo JAVA_HOME: %JAVA_HOME%
echo ANDROID_HOME: %ANDROID_HOME%
echo.

echo [2/2] Building Release APK...
call gradlew.bat assembleRelease --no-daemon

echo.
if exist "app\build\outputs\apk\release\app-release.apk" (
    echo ================================================
    echo  BUILD SUCCESSFUL!
    echo ================================================
    echo.
    echo Copying APK to mobile folder and Desktop...
    copy "app\build\outputs\apk\release\app-release.apk" "..\KenyaPay-v3.5.0.apk"
    copy "app\build\outputs\apk\release\app-release.apk" "%USERPROFILE%\Desktop\KenyaPay-v3.5.0.apk"
    echo.
    echo APK saved to: KenyaPay-v3.5.0.apk (and Desktop)
    echo.
) else (
    echo ================================================
    echo  BUILD FAILED - Check errors above
    echo ================================================
)
pause
