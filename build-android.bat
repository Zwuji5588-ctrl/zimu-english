@echo off
echo Building web app...
cd /d "%~dp0"
node backend\build.js
echo Copying to Android...
xcopy /y /e dist\* android\app\src\main\assets\public\
echo Done! Open android/ in Android Studio to build.
pause