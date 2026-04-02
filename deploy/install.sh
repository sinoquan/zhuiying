#!/bin/bash
# ============================================
# 追影 - 一键部署脚本
# 适用于飞牛NAS Docker环境
# ============================================

set -e

# ============================================
# 配置区域
# ============================================

# 部署目录
DEPLOY_BASE="/vol2/1000/Docker/zhuiying"
POSTGRES_DIR="$DEPLOY_BASE/postgres"
PROJECT_DIR="$DEPLOY_BASE/zhuiying_os"
BACKUP_DIR="$DEPLOY_BASE/backups"

# 数据库配置
DB_USER="zhuiying"
DB_PASSWORD="zhuiying_secret_2024"
DB_NAME="zhuiying"
DB_PORT="5433"

# 应用配置
APP_PORT="35588"

# Git仓库
REPO_URL="https://github.com/sinoquan/zhuiying.git"
BRANCH="main"

# ============================================
# 颜色输出
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================
# 辅助函数
# ============================================

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║              🎬 追影 - NAS网盘推送系统 🎬                     ║"
    echo "║                                                              ║"
    echo "║          一键部署脚本 v1.0                                   ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# ============================================
# 检查环境
# ============================================

check_environment() {
    print_step "检查系统环境"
    
    # 检查 Docker
    if ! check_command docker; then
        print_error "Docker 未安装"
        echo "请先安装 Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker 已安装: $(docker --version)"
    
    # 检查 Docker Compose
    if ! check_command docker-compose && ! docker compose version &> /dev/null; then
        print_error "Docker Compose 未安装"
        echo "请先安装 Docker Compose"
        exit 1
    fi
    print_success "Docker Compose 已安装"
    
    # 检查 Git
    if ! check_command git; then
        print_error "Git 未安装"
        echo "请先安装 Git"
        exit 1
    fi
    print_success "Git 已安装: $(git --version)"
    
    # 检查端口占用
    if netstat -tuln 2>/dev/null | grep -q ":$APP_PORT "; then
        print_warning "端口 $APP_PORT 已被占用"
        echo "请先停止占用该端口的服务，或修改脚本中的 APP_PORT 配置"
        read -p "是否继续？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success "端口 $APP_PORT 可用"
    fi
    
    # 检查目录权限
    if [ -d "$DEPLOY_BASE" ]; then
        print_success "部署目录已存在: $DEPLOY_BASE"
    else
        print_warning "部署目录不存在，将创建: $DEPLOY_BASE"
    fi
}

# ============================================
# 创建目录结构
# ============================================

create_directories() {
    print_step "创建目录结构"
    
    mkdir -p "$POSTGRES_DIR"
    mkdir -p "$PROJECT_DIR"
    mkdir -p "$BACKUP_DIR"
    
    print_success "目录结构创建完成"
    echo ""
    echo "目录说明："
    echo "  📁 项目代码: $PROJECT_DIR"
    echo "  📁 数据库:   $POSTGRES_DIR"
    echo "  📁 备份:     $BACKUP_DIR"
}

# ============================================
# 克隆代码
# ============================================

clone_code() {
    print_step "获取项目代码"
    
    cd "$DEPLOY_BASE"
    
    if [ -d "$PROJECT_DIR/.git" ]; then
        print_warning "项目已存在，正在更新..."
        cd "$PROJECT_DIR"
        git fetch origin $BRANCH
        git reset --hard origin/$BRANCH
        print_success "代码已更新"
    else
        print_warning "正在克隆项目..."
        git clone $REPO_URL "$PROJECT_DIR"
        print_success "项目克隆完成"
    fi
    
    cd "$PROJECT_DIR"
    COMMIT_HASH=$(git rev-parse --short HEAD)
    COMMIT_DATE=$(git log -1 --format='%cd' --date=format:'%Y-%m-%d %H:%M')
    echo ""
    echo "版本信息："
    echo "  提交: $COMMIT_HASH"
    echo "  时间: $COMMIT_DATE"
}

# ============================================
# 创建环境变量
# ============================================

create_env_file() {
    print_step "配置环境变量"
    
    cd "$DEPLOY_BASE"
    
    if [ -f ".env" ]; then
        print_warning ".env 文件已存在"
        read -p "是否覆盖？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_success "保留现有配置"
            return
        fi
    fi
    
    # 交互式配置
    echo ""
    echo -e "${CYAN}请输入配置信息（直接回车使用默认值）：${NC}"
    echo ""
    
    # TMDB API Key
    read -p "TMDB API Key（推荐配置，从 themoviedb.org 获取）: " TMDB_KEY
    TMDB_KEY=${TMDB_KEY:-your_tmdb_api_key_here}
    
    # 系统密码
    read -p "系统登录密码 [默认: admin123]: " SYS_PASSWORD
    SYS_PASSWORD=${SYS_PASSWORD:-admin123}
    
    # 代理设置
    read -p "代理地址（可选，如 http://127.0.0.1:7890）: " PROXY
    
    # 写入配置文件
    cat > .env << EOF
# 追影 - 环境变量配置
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

# ============ 数据库配置 ============
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@postgres:5432/$DB_NAME

# ============ 系统配置 ============
DEPLOY_RUN_PORT=$APP_PORT
COZE_PROJECT_ENV=PROD
SYSTEM_PASSWORD=$SYS_PASSWORD

# ============ TMDB API ============
TMDB_API_KEY=$TMDB_KEY

# ============ 代理配置 ============
EOF

    if [ -n "$PROXY" ]; then
        echo "HTTPS_PROXY=$PROXY" >> .env
    else
        echo "# HTTPS_PROXY=http://127.0.0.1:7890" >> .env
    fi

    cat >> .env << EOF

# ============ Node.js 配置 ============
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=2048
EOF

    print_success ".env 配置文件已创建"
    
    if [ "$TMDB_KEY" = "your_tmdb_api_key_here" ]; then
        print_warning "请稍后配置 TMDB API Key 以启用智能识别功能"
    fi
}

# ============================================
# 创建 Docker Compose 配置
# ============================================

create_docker_compose() {
    print_step "创建 Docker Compose 配置"
    
    cd "$DEPLOY_BASE"
    
    cat > docker-compose.yml << 'EOF'
# 追影 - NAS网盘推送系统
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    container_name: zhuiying-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: zhuiying
      POSTGRES_PASSWORD: zhuiying_secret_2024
      POSTGRES_DB: zhuiying
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - ./postgres:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zhuiying -d zhuiying"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - zhuiying-network

  # 追影应用
  app:
    image: node:20-alpine
    container_name: zhuiying-app
    restart: unless-stopped
    working_dir: /app
    env_file:
      - .env
    volumes:
      - ./zhuiying_os:/app
      - pnpm-cache:/root/.local/share/pnpm
    ports:
      - "35588:35588"
    depends_on:
      postgres:
        condition: service_healthy
    command: sh -c "
      echo '🚀 启动追影服务...' &&
      apk add --no-cache git python3 &&
      corepack enable &&
      if [ ! -d /app/node_modules ]; then
        echo '📦 安装依赖...' &&
        pnpm install --frozen-lockfile
      fi &&
      echo '🔄 初始化数据库...' &&
      pnpm run db:push || true &&
      echo '🌟 构建应用...' &&
      pnpm run build &&
      echo '✅ 启动服务...' &&
      pnpm run start
    "
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:35588/api/auth"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s
    networks:
      - zhuiying-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  zhuiying-network:
    driver: bridge

volumes:
  pnpm-cache:
EOF

    print_success "docker-compose.yml 已创建"
}

# ============================================
# 启动服务
# ============================================

start_services() {
    print_step "启动服务"
    
    cd "$DEPLOY_BASE"
    
    # 停止旧容器（如果存在）
    if docker ps -a | grep -q "zhuiying-app"; then
        print_warning "停止旧容器..."
        docker-compose down 2>/dev/null || true
    fi
    
    # 启动新容器
    print_warning "正在启动服务，首次启动需要几分钟..."
    docker-compose up -d
    
    echo ""
    print_warning "等待服务启动..."
    
    # 等待服务就绪
    MAX_WAIT=180
    WAIT_COUNT=0
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        if curl -s "http://localhost:$APP_PORT/api/auth" > /dev/null 2>&1; then
            print_success "服务启动成功！"
            break
        fi
        
        # 检查容器是否在运行
        if ! docker ps | grep -q "zhuiying-app"; then
            print_error "容器启动失败，查看日志："
            docker-compose logs --tail=50 app
            exit 1
        fi
        
        sleep 5
        WAIT_COUNT=$((WAIT_COUNT + 5))
        echo -n "."
    done
    echo ""
    
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        print_warning "服务启动时间较长，请稍后手动检查"
    fi
}

# ============================================
# 创建便捷脚本
# ============================================

create_helper_scripts() {
    print_step "创建便捷脚本"
    
    cd "$DEPLOY_BASE"
    
    # 更新脚本
    cat > update.sh << 'SCRIPT'
#!/bin/bash
cd "$(dirname "$0")/zhuiying_os"
bash deploy/update.sh "$@"
SCRIPT
    chmod +x update.sh
    
    # 快速更新脚本
    cat > quick-update.sh << 'SCRIPT'
#!/bin/bash
cd "$(dirname "$0")/zhuiying_os"
bash deploy/quick-update.sh
SCRIPT
    chmod +x quick-update.sh
    
    # 数据库备份脚本
    cat > backup.sh << 'SCRIPT'
#!/bin/bash
BACKUP_DIR="$(dirname "$0")/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql"
docker exec zhuiying-postgres pg_dump -U zhuiying zhuiying > "$BACKUP_FILE"
echo "✅ 数据库已备份到: $BACKUP_FILE"
SCRIPT
    chmod +x backup.sh
    
    # 日志查看脚本
    cat > logs.sh << 'SCRIPT'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose logs -f "$@"
SCRIPT
    chmod +x logs.sh
    
    # 重启脚本
    cat > restart.sh << 'SCRIPT'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose restart
echo "✅ 服务已重启"
SCRIPT
    chmod +x restart.sh
    
    # 停止脚本
    cat > stop.sh << 'SCRIPT'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose down
echo "✅ 服务已停止"
SCRIPT
    chmod +x stop.sh
    
    print_success "便捷脚本已创建"
    echo ""
    echo "可用脚本："
    echo "  📜 update.sh      - 更新服务"
    echo "  📜 quick-update.sh - 快速更新"
    echo "  📜 backup.sh      - 备份数据库"
    echo "  📜 logs.sh        - 查看日志"
    echo "  📜 restart.sh     - 重启服务"
    echo "  📜 stop.sh        - 停止服务"
}

# ============================================
# 显示完成信息
# ============================================

show_completion() {
    # 获取IP地址
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║                   🎉 部署完成！🎉                            ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  访问地址${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  🌐 本地访问: ${GREEN}http://localhost:$APP_PORT${NC}"
    echo -e "  🌐 局域网访问: ${GREEN}http://$LOCAL_IP:$APP_PORT${NC}"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  登录信息${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  🔑 密码: ${YELLOW}$SYS_PASSWORD${NC}"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  常用命令${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  查看日志:   ${YELLOW}cd $DEPLOY_BASE && ./logs.sh${NC}"
    echo -e "  更新服务:   ${YELLOW}cd $DEPLOY_BASE && ./update.sh${NC}"
    echo -e "  重启服务:   ${YELLOW}cd $DEPLOY_BASE && ./restart.sh${NC}"
    echo -e "  备份数据:   ${YELLOW}cd $DEPLOY_BASE && ./backup.sh${NC}"
    echo -e "  停止服务:   ${YELLOW}cd $DEPLOY_BASE && ./stop.sh${NC}"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  配置文件${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  📁 环境变量: ${YELLOW}$DEPLOY_BASE/.env${NC}"
    echo -e "  📁 Docker配置: ${YELLOW}$DEPLOY_BASE/docker-compose.yml${NC}"
    echo -e "  📁 数据库: ${YELLOW}$DEPLOY_BASE/postgres${NC}"
    echo ""
    echo -e "${YELLOW}提示: 请妥善保管登录密码，并及时修改 TMDB API Key${NC}"
    echo ""
}

# ============================================
# 主流程
# ============================================

main() {
    print_banner
    
    # 检查是否为 root 用户
    if [ "$EUID" -ne 0 ]; then
        print_warning "建议使用 root 用户执行"
    fi
    
    check_environment
    create_directories
    clone_code
    create_env_file
    create_docker_compose
    start_services
    create_helper_scripts
    show_completion
}

# 执行主流程
main "$@"
