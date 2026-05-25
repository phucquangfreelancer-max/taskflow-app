@echo off
setlocal

cd /d "%~dp0"

if not exist "package.json" (
  echo Khong tim thay package.json trong thu muc:
  echo %CD%
  pause
  exit /b 1
)

set "LOCAL_ELECTRON=node_modules\.bin\electron.cmd"
set "PORTABLE_ELECTRON=E:\APP\electron-v33.0.0-win32-x64\electron.exe"
set "ELECTRON_CMD="

if exist "%LOCAL_ELECTRON%" (
  call "%LOCAL_ELECTRON%" --version >nul 2>&1
  if not errorlevel 1 (
    set "ELECTRON_CMD=%LOCAL_ELECTRON%"
  )
)

if "%ELECTRON_CMD%"=="" if exist "%PORTABLE_ELECTRON%" (
  set "ELECTRON_CMD=%PORTABLE_ELECTRON%"
)

if "%ELECTRON_CMD%"=="" (
  echo Chua co Electron chay duoc. Dang cai dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Cai dependencies that bai. Hay kiem tra Node.js/npm va ket noi mang.
    pause
    exit /b 1
  )

  if exist "%LOCAL_ELECTRON%" (
    call "%LOCAL_ELECTRON%" --version >nul 2>&1
    if not errorlevel 1 (
      set "ELECTRON_CMD=%LOCAL_ELECTRON%"
    )
  )
)

if "%ELECTRON_CMD%"=="" (
  echo.
  echo Khong tim thay Electron chay duoc.
  echo Hay chay: npm.cmd install
  pause
  exit /b 1
)

echo Dang khoi dong TaskFlow...
call "%ELECTRON_CMD%" .

if errorlevel 1 (
  echo.
  echo TaskFlow khong khoi dong duoc. Hay xem loi o tren.
  pause
  exit /b 1
)

endlocal
