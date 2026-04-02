#!/bin/bash
# ============================================
# 追影 - 自动更新脚本
# 用于飞牛NAS Docker环境
# ============================================

set -e

# 配置
PROJECT_DIR="/vol2/1000/Docker/zhuiying/zhuiying_os"
COMPOSE_DIR="/vol2/1000/Docker/zhuiying"
BACKUP_DIR="/vol2/1000/Docker/zhuiying/backups"
REPO_URL="https://github.com/sinoquan/zhuiying.git"
BRANCH="main"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    追影 - 自动更新脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查项目目录
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}项目目录不存在，正在克隆...${NC}"
    git clone $REPO_URL $PROJECT_DIR
    cd $PROJECT_DIR
else
    cd $PROJECT_DIR
    
    # 保存本地修改（如 .env 文件）
    if [ -f ".env" ]; then
        echo -e "${BLUE}保存环境变量配置...${NC}"
        cp .env /tmp/zhuiying.env.bak
    fi
    
    # 检查是否有更新
    echo -e "${BLUE}检查更新...${NC}"
    git fetch origin $BRANCH
    
    LOCAL_HASH=$(git rev-parse HEAD)
    REMOTE_HASH=$(git rev-parse origin/$BRANCH)
    
    if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
        echo -e "${GREEN}✓ 已是最新版本，无需更新${NC}"
        
        # 恢复环境变量
        if [ -f "/tmp/zhuiying.env.bak" ]; then
            cp /tmp/zhuiying.env.bak .env
        fi
        
        exit 0
    fi
    
    echo -e "${YELLOW}发现新版本，准备更新...${NC}"
    echo -e "  本地: ${LOCAL_HASH:0:8}"
    echo -e "  远程: ${REMOTE_HASH:0:8}"
fi

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份当前版本
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
echo -e "${BLUE}备份当前版本到 ${BACKUP_NAME}...${NC}"
cp -r $PROJECT_DIR $BACKUP_DIR/$BACKUP_NAME

# 拉取最新代码
echo -e "${BLUE}拉取最新代码...${NC}"
git fetch origin $BRANCH
git reset --hard origin/$BRANCH

# 恢复环境变量
if [ -f "/tmp/zhuiying.env.bak" ]; then
    echo -e "${BLUE}恢复环境变量配置...${NC}"
    cp /tmp/zhuiying.env.bak $PROJECT_DIR/.env
fi

# 检查是否需要完整重建
if [ "$1" = "--full" ]; then
    echo -e "${YELLOW}完整重建模式：停止服务并清理...${NC}"
    
    cd $COMPOSE_DIR
    docker-compose down
    
    echo -e "${BLUE}清理旧的构建缓存...${NC}"
    rm -rf $PROJECT_DIR/node_modules
    rm -rf $PROJECT_DIR/.next
    
    echo -e "${BLUE}重新构建并启动服务...${NC}"
    docker-compose up -d --build
    
else
    # 快速更新：只重启容器
    echo -e "${BLUE}快速更新模式：重启服务...${NC}"
    
    # 在容器内安装依赖并重启
    docker exec zhuiying-app sh -c "
        corepack enable &&
        pnpm install --frozen-lockfile &&
        pnpm run build
    " || {
        echo -e "${YELLOW}容器内更新失败，尝试完整重建...${NC}"
        cd $COMPOSE_DIR
        docker-compose down
        docker-compose up -d --build
    }
    
    docker restart zhuiying-app
fi

# 等待服务启动
echo -e "${BLUE}等待服务启动...${NC}"
sleep 15

# 检查服务状态
if curl -s http://localhost:35588/api/auth > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 服务启动成功！${NC}"
    echo -e "${GREEN}✓ 访问地址: http://localhost:35588${NC}"
else
    echo -e "${RED}✗ 服务启动失败，请检查日志${NC}"
    echo -e "  查看日志: docker-compose -f $COMPOSE_DIR/docker-compose.yml logs -f app"
fi

# 执行数据库迁移
echo -e "${BLUE}检查数据库迁移...${NC}"
docker exec zhuiying-app sh -c "cd /app && pnpm run db:push" || {
    echo -e "${YELLOW}⚠ 数据库迁移失败，可能需要手动处理${NC}"
}

# 清理旧备份（保留最近5个）
echo -e "${BLUE}清理旧备份...${NC}"
cd $BACKUP_DIR
ls -t | tail -n +6 | xargs -r rm -rf

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    更新完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "更新说明："
echo "  - 代码已更新到最新版本"
echo "  - 数据库已自动迁移"
echo "  - 旧版本已备份到 $BACKUP_DIR/$BACKUP_NAME"
echo ""
echo "如有问题，请查看日志："
echo "  docker logs -f zhuiying-app"
