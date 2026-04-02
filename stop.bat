@echo off
chcp 65001 >nul
echo ========================================
echo        追影 - 停止服务
echo ========================================
echo.
echo 正在停止 Node.js 进程...
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo 服务已停止
) else (
    echo 没有运行中的服务
)
echo.
pause
