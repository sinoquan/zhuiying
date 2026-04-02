#!/bin/bash
# ============================================
# 追影 - 更新脚本
# 拉取最新镜像并重启服务
# ============================================

set -e

cd "$(dirname "$0")"

echo "🔄 更新追影服务..."
echo ""

# 拉取最新镜像
echo "📥 拉取最新镜像..."
docker compose pull

# 重启服务
echo "🔄 重启服务..."
docker compose down
docker compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
if curl -s http://localhost:35588/api/auth > /dev/null 2>&1; then
    echo ""
    echo "✅ 更新完成！"
    echo "🌐 访问地址: http://localhost:35588"
else
    echo ""
    echo "⚠️ 服务启动中，请稍后访问..."
    echo "📋 查看日志: docker compose logs -f"
fi
