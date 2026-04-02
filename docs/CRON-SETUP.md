# 定时任务配置指南

追影系统支持通过定时任务实现自动化监控和推送。本文档介绍如何配置定时任务。

---

## 方式一：Linux Cron（推荐）

### 1. 编辑 crontab

```bash
crontab -e
```

### 2. 添加定时任务

```bash
# 每 5 分钟执行一次监控扫描
*/5 * * * * curl -X POST http://localhost:5000/api/monitor/cron >> /var/log/zhuiying-cron.log 2>&1

# 或者指定 token（推荐）
*/5 * * * * curl -X POST -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/monitor/cron >> /var/log/zhuiying-cron.log 2>&1
```

### 3. Cron 表达式说明

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日期 (1 - 31)
│ │ │ ┌───────────── 月份 (1 - 12)
│ │ │ │ ┌───────────── 星期几 (0 - 7，0 和 7 都表示周日)
│ │ │ │ │
* * * * * command
```

常用示例：
```bash
*/5 * * * *     # 每 5 分钟
0 * * * *       # 每小时
0 */2 * * *     # 每 2 小时
0 9 * * *       # 每天 9:00
0 9,18 * * *    # 每天 9:00 和 18:00
*/10 7-23 * * * # 7:00-23:00 每 10 分钟
```

---

## 方式二：Windows 任务计划程序

### 1. 打开任务计划程序

- 按 `Win + R`，输入 `taskschd.msc`

### 2. 创建基本任务

1. 点击右侧「创建基本任务」
2. 名称：`追影监控任务`
3. 触发器：选择「每天」，然后点击「高级设置」→「重复任务间隔」→「5 分钟」
4. 操作：选择「启动程序」
   - 程序或脚本：`curl`
   - 参数：`-X POST http://localhost:5000/api/monitor/cron`

### 3. 使用 PowerShell 脚本

创建 `D:\zhuiying\cron.ps1`：

```powershell
# 调用监控 API
Invoke-RestMethod -Method POST -Uri "http://localhost:5000/api/monitor/cron"

# 记录日志
Add-Content -Path "D:\zhuiying\cron.log" -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - 执行完成"
```

在任务计划程序中：
- 程序或脚本：`powershell.exe`
- 参数：`-ExecutionPolicy Bypass -File "D:\zhuiying\cron.ps1"`

---

## 方式三：外部监控服务

### cron-job.org（免费）

1. 访问 https://cron-job.org
2. 注册账号
3. 创建新任务：
   - URL：`http://你的服务器IP:5000/api/monitor/cron`
   - 执行频率：每 5 分钟
   - HTTP 方法：POST

### UptimeRobot（免费）

1. 访问 https://uptimerobot.com
2. 创建新的 Monitor
3. Monitor Type：HTTP(s)
4. URL：`http://你的服务器IP:5000/api/monitor/cron`
5. 勾选「Send HTTP method as POST」

---

## 方式四：Docker 环境

如果使用 Docker 部署，可以在 docker-compose.yml 中添加定时任务容器：

```yaml
services:
  # 主应用
  app:
    image: ghcr.io/sinoquan/zhuiying:latest
    # ... 其他配置

  # 定时任务容器
  cron:
    image: curlimages/curl:latest
    command: >
      sh -c "while true; do
        curl -X POST http://app:5000/api/monitor/cron;
        sleep 300;
      done"
    depends_on:
      - app
```

---

## 安全配置

### 启用 Token 验证

在 `.env` 或 `.env.local` 中添加：

```bash
CRON_TOKEN=your_secure_token_here
```

然后在调用时携带 Token：

```bash
curl -X POST -H "Authorization: Bearer your_secure_token_here" http://localhost:5000/api/monitor/cron
```

---

## 监控状态检查

### 查看 API 状态

```bash
curl http://localhost:5000/api/monitor/cron
```

### 查看日志

```bash
# Linux
tail -f /var/log/zhuiying-cron.log

# Docker
docker logs zhuiying-app -f

# Windows
Get-Content D:\zhuiying\cron.log -Tail 50
```

---

## 定时任务执行流程

```
定时任务触发
    ↓
调用 /api/monitor/cron
    ↓
执行监控扫描
    ├── 扫描所有启用的监控任务
    ├── 发现新文件
    ├── 检测完结状态
    ├── 创建分享
    ├── 记录分享记录
    └── 自动推送
    ↓
重试失败的推送
    ├── 查询失败记录
    ├── 计算重试延迟
    └── 重新推送
    ↓
返回执行结果
```

---

## 常见问题

### Q: 定时任务没有执行？

1. 检查 cron 服务是否运行：`systemctl status cron`
2. 检查日志文件权限
3. 确认 curl 命令可执行：`which curl`

### Q: 执行报错 401 Unauthorized？

检查是否设置了 `CRON_TOKEN`，调用时是否携带了正确的 Authorization header。

### Q: 如何查看执行结果？

查看应用日志或 cron 日志文件。

---

## 推荐配置

| 场景 | 频率 | Cron 表达式 |
|------|------|-------------|
| 高频监控 | 每 5 分钟 | `*/5 * * * *` |
| 常规监控 | 每 10 分钟 | `*/10 * * * *` |
| 低频监控 | 每 30 分钟 | `*/30 * * * *` |
| 仅工作时间 | 工作时间每 10 分钟 | `*/10 7-23 * * *` |
