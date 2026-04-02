/**
 * 数据库操作层
 * 支持 DATABASE_URL（PostgreSQL）和 Supabase 两种模式
 */

import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './shared/schema';

let dbInstance: NodePgDatabase<typeof schema> | null = null;
let poolInstance: Pool | null = null;

/**
 * 获取数据库实例
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }

  // 优先使用 DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    poolInstance = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    dbInstance = drizzle(poolInstance, { schema });
    return dbInstance;
  }

  throw new Error('DATABASE_URL is not set');
}

/**
 * 关闭数据库连接
 */
export async function closeDb(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}

// 导出 schema
export * from './shared/schema';
