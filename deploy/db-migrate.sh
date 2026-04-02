#!/bin/bash
# ============================================
# 追影 - 数据库迁移脚本
# 用于处理数据库结构变更
# ============================================

set -e

PROJECT_DIR="/vol2/1000/Docker/zhuiying/zhuiying_os"

echo "🗄️  数据库迁移工具"
echo "================================"

cd $PROJECT_DIR

case "$1" in
    "push")
        echo "📤 推送数据库结构变更..."
        docker exec -it zhuiying-app sh -c "cd /app && npx drizzle-kit push"
        ;;
    "generate")
        echo "📝 生成迁移文件..."
        docker exec -it zhuiying-app sh -c "cd /app && npx drizzle-kit generate"
        ;;
    "migrate")
        echo "🔄 执行迁移..."
        docker exec -it zhuiying-app sh -c "cd /app && npx drizzle-kit migrate"
        ;;
    "studio")
        echo "🔍 启动数据库管理界面..."
        docker exec -it zhuiying-app sh -c "cd /app && npx drizzle-kit studio"
        ;;
    "backup")
        echo "💾 备份数据库..."
        BACKUP_FILE="/vol2/1000/Docker/zhuiying/backups/db_$(date +%Y%m%d_%H%M%S).sql"
        docker exec zhuiying-postgres pg_dump -U zhuiying zhuiying > $BACKUP_FILE
        echo "✅ 备份完成: $BACKUP_FILE"
        ;;
    "restore")
        if [ -z "$2" ]; then
            echo "❌ 请指定备份文件"
            echo "用法: $0 restore <backup_file>"
            exit 1
        fi
        echo "📥 恢复数据库..."
        cat $2 | docker exec -i zhuiying-postgres psql -U zhuiying zhuiying
        echo "✅ 恢复完成"
        ;;
    *)
        echo "用法: $0 <command>"
        echo ""
        echo "命令:"
        echo "  push      - 直接推送数据库结构变更（推荐）"
        echo "  generate  - 生成迁移文件"
        echo "  migrate   - 执行迁移"
        echo "  studio    - 启动数据库管理界面"
        echo "  backup    - 备份数据库"
        echo "  restore   - 恢复数据库"
        ;;
esac
