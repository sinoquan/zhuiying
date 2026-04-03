import { WebSocket, type WebSocketServer } from 'ws';
import { watch } from 'fs';
import { existsSync, statSync } from 'fs';
import { readFile } from 'fs/promises';

const LOG_FILE = '/app/work/logs/bypass/app.log';

interface LogEntry {
  level: 'info' | 'error' | 'warn';
  message: string;
  timestamp: number;
}

interface TaskInfo {
  id: string;
  type: 'scan' | 'share' | 'push' | 'renew';
  status: 'running' | 'completed' | 'failed';
  message: string;
  progress?: string;
  startTime: number;
  endTime?: number;
}

interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

// 存储所有连接的客户端
const clients = new Set<WebSocket>();
let fileWatcher: ReturnType<typeof watch> | null = null;
let lastSize = 0;

// 任务追踪
const activeTasks = new Map<string, TaskInfo>();

export function setupLogsHandler(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    
    // 发送最近的日志
    sendRecentLogs(ws);
    
    // 发送当前任务状态
    sendTasksStatus(ws);
    
    ws.on('message', (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', payload: null }));
        } else if (msg.type === 'get_recent') {
          sendRecentLogs(ws, msg.payload as number || 50);
        } else if (msg.type === 'get_tasks') {
          sendTasksStatus(ws);
        }
      } catch {
        // 忽略解析错误
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
    });
  });
  
  // 启动文件监听
  startFileWatcher();
}

// 导出任务管理函数
export function startTask(task: Omit<TaskInfo, 'startTime'>) {
  const fullTask: TaskInfo = {
    ...task,
    startTime: Date.now(),
  };
  activeTasks.set(task.id, fullTask);
  broadcast({ type: 'task_start', payload: fullTask });
}

export function updateTask(taskId: string, update: Partial<TaskInfo>) {
  const task = activeTasks.get(taskId);
  if (task) {
    Object.assign(task, update);
    broadcast({ type: 'task_update', payload: task });
  }
}

export function endTask(taskId: string, status: 'completed' | 'failed', message?: string) {
  const task = activeTasks.get(taskId);
  if (task) {
    task.status = status;
    task.endTime = Date.now();
    if (message) task.message = message;
    broadcast({ type: 'task_end', payload: task });
    // 延迟移除，让客户端有时间显示完成状态
    setTimeout(() => activeTasks.delete(taskId), 5000);
  }
}

export function getActiveTasks(): TaskInfo[] {
  return Array.from(activeTasks.values());
}

function startFileWatcher() {
  if (!existsSync(LOG_FILE)) {
    setTimeout(startFileWatcher, 5000);
    return;
  }
  
  try {
    lastSize = statSync(LOG_FILE).size;
    
    fileWatcher = watch(LOG_FILE, (eventType) => {
      if (eventType === 'change') {
        readNewLogs();
      }
    });
    
    fileWatcher.on('error', () => {
      setTimeout(startFileWatcher, 5000);
    });
  } catch {
    setTimeout(startFileWatcher, 5000);
  }
}

async function readNewLogs() {
  try {
    if (!existsSync(LOG_FILE)) return;
    
    const currentSize = statSync(LOG_FILE).size;
    if (currentSize <= lastSize) {
      lastSize = currentSize;
      return;
    }
    
    const fd = await import('fs/promises').then(m => m.open(LOG_FILE, 'r'));
    const buffer = Buffer.alloc(currentSize - lastSize);
    await fd.read(buffer, 0, buffer.length, lastSize);
    await fd.close();
    
    lastSize = currentSize;
    
    const newLines = buffer.toString('utf-8').trim().split('\n');
    const newLogs: LogEntry[] = [];
    
    for (const line of newLines) {
      if (!line.trim()) continue;
      try {
        const log = JSON.parse(line) as LogEntry;
        newLogs.push(log);
      } catch {
        // 忽略解析错误
      }
    }
    
    if (newLogs.length > 0) {
      broadcast({ type: 'logs_new', payload: newLogs });
    }
  } catch (error) {
    console.error('读取新日志失败:', error);
  }
}

async function sendRecentLogs(ws: WebSocket, limit: number = 50) {
  try {
    if (!existsSync(LOG_FILE)) return;
    
    const content = await readFile(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').slice(-limit);
    
    const logs: LogEntry[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        logs.push(JSON.parse(line) as LogEntry);
      } catch {
        // 忽略解析错误
      }
    }
    
    ws.send(JSON.stringify({ type: 'logs_init', payload: logs }));
  } catch (error) {
    console.error('发送最近日志失败:', error);
  }
}

function sendTasksStatus(ws: WebSocket) {
  const tasks = Array.from(activeTasks.values());
  if (tasks.length > 0) {
    ws.send(JSON.stringify({ type: 'tasks_status', payload: tasks }));
  }
}

function broadcast(msg: WsMessage) {
  const data = JSON.stringify(msg);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
