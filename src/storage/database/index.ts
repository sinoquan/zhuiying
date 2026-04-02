/**
 * 数据库连接模块
 * 支持 DATABASE_URL（自托管PostgreSQL）或 COZE_SUPABASE_URL（Supabase云数据库）
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let poolInstance: Pool | null = null;

/**
 * 获取数据库连接URL
 */
function getDatabaseUrl(): string {
  // 优先使用 DATABASE_URL（自托管数据库）
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return databaseUrl;
  }

  // 回退到 Supabase URL
  const supabaseUrl = process.env.COZE_SUPABASE_URL;
  if (supabaseUrl) {
    // 将 Supabase URL 转换为 PostgreSQL 连接字符串
    // Supabase URL 格式: https://xxx.supabase.co
    // PostgreSQL 连接格式: postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
    const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY;
    
    // 从 Supabase URL 提取项目 ID
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match && serviceKey) {
      const projectId = match[1];
      // 注意：这里需要数据库密码，而不是 anon key
      // 如果使用 Supabase，需要在环境变量中设置 DATABASE_URL
      console.warn('警告: 使用 Supabase 时建议设置 DATABASE_URL 环境变量');
      return `postgresql://postgres:${serviceKey}@db.${projectId}.supabase.co:5432/postgres`;
    }
  }

  throw new Error('请设置 DATABASE_URL 或 COZE_SUPABASE_URL 环境变量');
}

/**
 * 获取数据库连接池
 */
function getPool(): Pool {
  if (poolInstance) {
    return poolInstance;
  }

  const connectionString = getDatabaseUrl();
  
  poolInstance = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // 错误处理
  poolInstance.on('error', (err) => {
    console.error('数据库连接池错误:', err);
  });

  return poolInstance;
}

/**
 * 获取 Drizzle ORM 实例
 */
export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const pool = getPool();
  dbInstance = drizzle(pool, { schema });

  return dbInstance;
}

/**
 * 关闭数据库连接
 */
export async function closeDb() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}

// 导出 schema
export * from './shared/schema';

// 默认导出数据库实例
export default getDb;
