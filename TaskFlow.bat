@echo off
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im electron.exe >nul 2>&1
timeout /t 1 >nul
E:\APP\electron-v33.0.0-win32-x64\electron.exe E:\APP\TaskFlow\electron.cjs
