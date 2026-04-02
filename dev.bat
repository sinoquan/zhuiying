@echo off
chcp 65001 >nul
echo ========================================
echo        追影 - 开发环境启动脚本
echo ========================================
echo.

echo [1/3] 拉取最新代码...
git pull
if %errorlevel% neq 0 (
    echo 拉取代码失败，请检查网络连接
    pause
    exit /b 1
)
echo 代码更新完成！
echo.

echo [2/3] 检查依赖更新...
pnpm install --prefer-offline
echo 依赖检查完成！
echo.

echo [3/3] 启动开发服务器...
echo 访问地址: http://localhost:5000
echo 按 Ctrl+C 可停止服务
echo.
npx next dev --port 5000
