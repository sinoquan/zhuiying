#!/bin/bash
# ============================================
# 追影 - 快速更新脚本（仅更新代码）
# 适用于日常小更新，不重建Docker镜像
# ============================================

set -e

PROJECT_DIR="/vol2/1000/Docker/zhuiying/zhuiying_os"

echo "🚀 快速更新追影..."

cd $PROJECT_DIR

# 保存环境变量
[ -f .env ] && cp .env /tmp/zhuiying.env.bak

# 拉取代码
git fetch origin main
git reset --hard origin/main

# 恢复环境变量
[ -f /tmp/zhuiying.env.bak ] && cp /tmp/zhuiying.env.bak .env

# 进入容器重新安装依赖并重启
echo "📦 更新依赖..."
docker exec zhuiying-app sh -c "corepack enable && pnpm install --prod"

echo "🔄 重启服务..."
docker restart zhuiying-app

echo "✅ 更新完成！"
echo "🌐 访问: http://localhost:35588"
