@echo off
chcp 65001 >nul
cd /d E:\APP\TaskFLow

echo Dang upload code len GitHub...
git add .
git commit -m "update"
git push

echo.
echo Xong! Render se tu dong deploy lai trong ~3 phut.
pause
