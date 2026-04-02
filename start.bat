@echo off
chcp 65001 >nul
echo ========================================
echo        追影 - 快速启动（不更新代码）
echo ========================================
echo.
echo 启动开发服务器...
echo 访问地址: http://localhost:5000
echo 按 Ctrl+C 可停止服务
echo.
npx next dev --port 5000
