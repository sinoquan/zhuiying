# 追影 - 生产环境 Dockerfile
# 构建完成后直接运行，无需在容器内构建

# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（包括 devDependencies）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# ============ 运行阶段 ============
FROM node:20-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=2048

# 安装运行时依赖
RUN apk add --no-cache python3

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制构建产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/storage/database ./src/storage/database

# 安装生产依赖
RUN pnpm install --prod

# 暴露端口
EXPOSE 35588

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:35588/api/auth || exit 1

# 启动命令
CMD ["node", "server.js"]
