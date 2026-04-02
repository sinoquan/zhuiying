/**
 * Supabase 兼容客户端
 * 使用 DATABASE_URL 连接 PostgreSQL，提供与 Supabase 兼容的 API
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, or, desc, asc, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import * as schema from './shared/schema';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

type TableKey = keyof typeof schema;

/**
 * 创建查询构建器
 */
function createQueryBuilder(tableName: TableKey) {
  const table = schema[tableName];
  
  let whereConditions: any[] = [];
  let order_by: { column: any; direction: 'asc' | 'desc' } | null = null;
  let limit_count: number | null = null;
  let offset_count: number | null = null;
  let selectColumns: string[] = ['*'];
  let insertData: any = null;
  let updateData: any = null;
  let isSingle = false;
  let isUpsert = false;

  const builder = {
    select(columns: string[]) {
      selectColumns = columns;
      return builder;
    },
    
    insert(data: any) {
      insertData = data;
      return builder;
    },
    
    update(data: any) {
      updateData = data;
      return builder;
    },
    
    upsert(data: any) {
      insertData = data;
      isUpsert = true;
      return builder;
    },
    
    delete() {
      return builder;
    },
    
    eq(column: string, value: any) {
      whereConditions.push(eq((table as any)[column], value));
      return builder;
    },
    
    neq(column: string, value: any) {
      whereConditions.push(sql`${(table as any)[column]} != ${value}`);
      return builder;
    },
    
    in(column: string, values: any[]) {
      whereConditions.push(inArray((table as any)[column], values));
      return builder;
    },
    
    is(column: string, value: null | boolean) {
      if (value === null) {
        whereConditions.push(isNull((table as any)[column]));
      } else {
        whereConditions.push(isNotNull((table as any)[column]));
      }
      return builder;
    },
    
    order(column: string, options?: { ascending?: boolean }) {
      const direction = options?.ascending === false ? 'desc' : 'asc';
      if (direction === 'asc') {
        order_by = { column: (table as any)[column], direction: 'asc' };
      } else {
        order_by = { column: (table as any)[column], direction: 'desc' };
      }
      return builder;
    },
    
    limit(count: number) {
      limit_count = count;
      return builder;
    },
    
    offset(count: number) {
      offset_count = count;
      return builder;
    },
    
    single() {
      isSingle = true;
      limit_count = 1;
      return builder;
    },
    
    maybeSingle() {
      isSingle = true;
      limit_count = 1;
      return builder;
    },
    
    async execute() {
      if (!db) {
        throw new Error('Database not initialized');
      }
      
      // SELECT
      if (!insertData && !updateData) {
        let query = db.select().from(table);
        
        if (whereConditions.length > 0) {
          query = query.where(and(...whereConditions)) as any;
        }
        
        if (order_by) {
          if (order_by.direction === 'asc') {
            query = query.orderBy(asc(order_by.column)) as any;
          } else {
            query = query.orderBy(desc(order_by.column)) as any;
          }
        }
        
        if (limit_count) {
          query = query.limit(limit_count) as any;
        }
        
        if (offset_count) {
          query = query.offset(offset_count) as any;
        }
        
        const result = await query;
        return isSingle ? (result[0] || null) : result;
      }
      
      // INSERT
      if (insertData && !updateData) {
        const result = await db.insert(table).values(insertData).returning();
        return isSingle ? result[0] : result;
      }
      
      // UPDATE
      if (updateData) {
        let query = db.update(table).set(updateData);
        
        if (whereConditions.length > 0) {
          query = query.where(and(...whereConditions)) as any;
        }
        
        const result = await query.returning();
        return isSingle ? result[0] : result;
      }
      
      // DELETE
      if (whereConditions.length > 0) {
        const result = await db.delete(table).where(and(...whereConditions)).returning();
        return isSingle ? result[0] : result;
      }
      
      return [];
    }
  };
  
  return builder;
}

/**
 * 获取数据库客户端
 */
function getDbClient() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    
    pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    
    db = drizzle(pool, { schema });
  }
  
  return db;
}

/**
 * 创建 Supabase 兼容客户端
 */
export function createSupabaseClient() {
  return {
    from(tableName: TableKey) {
      return createQueryBuilder(tableName);
    },
    
    rpc(fnName: string, params?: any) {
      // RPC 暂不支持
      return Promise.resolve({ data: null, error: new Error('RPC not supported') });
    },
    
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
  };
}

/**
 * 获取数据库实例（用于直接操作）
 */
export function getDb() {
  return getDbClient();
}

/**
 * 关闭连接
 */
export async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export { schema };
