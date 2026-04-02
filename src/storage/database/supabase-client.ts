/**
 * 数据库客户端
 * 支持 DATABASE_URL（PostgreSQL）和 Supabase 两种模式
 */

import { Pool } from 'pg';

let pool: Pool | null = null;
let supabaseClient: any = null;

/**
 * 获取 PostgreSQL 连接池
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Please set DATABASE_URL or Supabase environment variables.');
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
}

/**
 * 执行 SQL 查询
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * 执行单行查询
 */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

/**
 * 执行插入并返回插入的行
 */
export async function insert<T = any>(table: string, data: Record<string, any>): Promise<T> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');
  
  const sql = `
    INSERT INTO ${table} (${columns})
    VALUES (${placeholders})
    RETURNING *
  `;
  
  const result = await queryOne<T>(sql, values);
  return result!;
}

/**
 * 执行更新并返回更新的行
 */
export async function update<T = any>(
  table: string,
  data: Record<string, any>,
  where: Record<string, any>
): Promise<T[]> {
  const setClauses = Object.keys(data).map((key, i) => `${key} = $${i + 1}`);
  const setValues = Object.values(data);
  
  const whereClauses = Object.keys(where).map((key, i) => `${key} = $${setValues.length + i + 1}`);
  const whereValues = Object.values(where);
  
  const sql = `
    UPDATE ${table}
    SET ${setClauses.join(', ')}
    WHERE ${whereClauses.join(' AND ')}
    RETURNING *
  `;
  
  return query<T>(sql, [...setValues, ...whereValues]);
}

/**
 * 执行删除
 */
export async function remove(
  table: string,
  where: Record<string, any>
): Promise<void> {
  const whereClauses = Object.keys(where).map((key, i) => `${key} = $${i + 1}`);
  const whereValues = Object.values(where);
  
  const sql = `DELETE FROM ${table} WHERE ${whereClauses.join(' AND ')}`;
  await query(sql, whereValues);
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Supabase 兼容客户端
 * 注意：这是一个简化实现，仅支持项目中使用的功能
 */
export function getSupabaseClient() {
  // 如果有 DATABASE_URL，返回兼容客户端
  if (process.env.DATABASE_URL) {
    return createPgClient();
  }
  
  // 否则使用 Supabase
  if (!supabaseClient) {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key are not set. Please set DATABASE_URL or Supabase environment variables.');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  
  return supabaseClient;
}

/**
 * PostgreSQL 兼容客户端（模拟 Supabase API）
 */
function createPgClient() {
  return {
    from(table: string) {
      return createTableClient(table);
    },
  };
}

function createTableClient(table: string) {
  let queryBuilder: any = {
    select: () => queryBuilder,
    insert: () => queryBuilder,
    update: () => queryBuilder,
    delete: () => queryBuilder,
    upsert: () => queryBuilder,
    eq: () => queryBuilder,
    neq: () => queryBuilder,
    in: () => queryBuilder,
    order: () => queryBuilder,
    limit: () => queryBuilder,
    offset: () => queryBuilder,
    single: () => queryBuilder,
    maybeSingle: () => queryBuilder,
    select: () => queryBuilder,
  };
  
  // 构建状态
  let selectColumns = '*';
  let insertData: any = null;
  let updateData: any = null;
  let isUpsert = false;
  let whereConditions: { column: string; op: string; value: any }[] = [];
  let orderBy: { column: string; ascending: boolean } | null = null;
  let limitCount: number | null = null;
  let offsetCount: number | null = null;
  let isSingle = false;
  
  const buildWhere = (values: any[]) => {
    const clauses: string[] = [];
    let paramIndex = values.length + 1;
    
    for (const cond of whereConditions) {
      if (cond.op === 'eq') {
        clauses.push(`${cond.column} = $${paramIndex}`);
        values.push(cond.value);
        paramIndex++;
      } else if (cond.op === 'neq') {
        clauses.push(`${cond.column} != $${paramIndex}`);
        values.push(cond.value);
        paramIndex++;
      } else if (cond.op === 'in') {
        const placeholders = cond.value.map(() => {
          values.push(cond.value);
          return `$${paramIndex++}`;
        });
        clauses.push(`${cond.column} IN (${placeholders.join(', ')})`);
      }
    }
    
    return clauses.length > 0 ? clauses.join(' AND ') : null;
  };
  
  const execute = async () => {
    try {
      // SELECT
      if (!insertData && !updateData) {
        const values: any[] = [];
        let sql = `SELECT ${selectColumns} FROM ${table}`;
        
        const whereClause = buildWhere([]);
        if (whereClause) {
          // 重新构建 where（因为上面是空数组）
          const whereValues: any[] = [];
          const clauses: string[] = [];
          let paramIndex = 1;
          
          for (const cond of whereConditions) {
            if (cond.op === 'eq') {
              clauses.push(`${cond.column} = $${paramIndex}`);
              whereValues.push(cond.value);
              paramIndex++;
            } else if (cond.op === 'in') {
              const placeholders = cond.value.map(() => `$${paramIndex++}`);
              clauses.push(`${cond.column} IN (${placeholders.join(', ')})`);
              whereValues.push(...cond.value);
            }
          }
          
          sql += ` WHERE ${clauses.join(' AND ')}`;
          values.push(...whereValues);
        }
        
        if (orderBy) {
          sql += ` ORDER BY ${orderBy.column} ${orderBy.ascending ? 'ASC' : 'DESC'}`;
        }
        
        if (limitCount) {
          sql += ` LIMIT ${limitCount}`;
        }
        
        if (offsetCount) {
          sql += ` OFFSET ${offsetCount}`;
        }
        
        const rows = await query(sql, values);
        const data = isSingle ? (rows[0] || null) : rows;
        
        return { data, error: null };
      }
      
      // INSERT
      if (insertData) {
        const keys = Object.keys(insertData);
        const values = Object.values(insertData);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        let sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        
        if (isUpsert) {
          // 简化的 upsert：ON CONFLICT DO NOTHING
          sql += ` ON CONFLICT DO NOTHING`;
        }
        
        sql += ' RETURNING *';
        
        const rows = await query(sql, values);
        const data = isSingle ? (rows[0] || null) : rows;
        
        return { data, error: null };
      }
      
      // UPDATE
      if (updateData) {
        const keys = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClauses = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
        
        let sql = `UPDATE ${table} SET ${setClauses}`;
        
        if (whereConditions.length > 0) {
          const whereValues: any[] = [];
          const clauses: string[] = [];
          let paramIndex = keys.length + 1;
          
          for (const cond of whereConditions) {
            if (cond.op === 'eq') {
              clauses.push(`${cond.column} = $${paramIndex}`);
              whereValues.push(cond.value);
              paramIndex++;
            } else if (cond.op === 'in') {
              const placeholders = cond.value.map(() => `$${paramIndex++}`);
              clauses.push(`${cond.column} IN (${placeholders.join(', ')})`);
              whereValues.push(...cond.value);
            }
          }
          
          sql += ` WHERE ${clauses.join(' AND ')}`;
          values.push(...whereValues);
        }
        
        sql += ' RETURNING *';
        
        const rows = await query(sql, values);
        const data = isSingle ? (rows[0] || null) : rows;
        
        return { data, error: null };
      }
      
      // DELETE
      {
        let sql = `DELETE FROM ${table}`;
        
        if (whereConditions.length > 0) {
          const whereValues: any[] = [];
          const clauses: string[] = [];
          let paramIndex = 1;
          
          for (const cond of whereConditions) {
            if (cond.op === 'eq') {
              clauses.push(`${cond.column} = $${paramIndex}`);
              whereValues.push(cond.value);
              paramIndex++;
            }
          }
          
          sql += ` WHERE ${clauses.join(' AND ')}`;
          
          const rows = await query(sql, whereValues);
          const data = isSingle ? (rows[0] || null) : rows;
          
          return { data, error: null };
        }
        
        await query(sql);
        return { data: null, error: null };
      }
    } catch (error) {
      return { data: null, error };
    }
  };
  
  // 链式 API
  queryBuilder.select = (columns?: string) => {
    selectColumns = columns || '*';
    return queryBuilder;
  };
  
  queryBuilder.insert = (data: any) => {
    insertData = data;
    return queryBuilder;
  };
  
  queryBuilder.update = (data: any) => {
    updateData = data;
    return queryBuilder;
  };
  
  queryBuilder.delete = () => {
    return queryBuilder;
  };
  
  queryBuilder.upsert = (data: any) => {
    insertData = data;
    isUpsert = true;
    return queryBuilder;
  };
  
  queryBuilder.eq = (column: string, value: any) => {
    whereConditions.push({ column, op: 'eq', value });
    return queryBuilder;
  };
  
  queryBuilder.neq = (column: string, value: any) => {
    whereConditions.push({ column, op: 'neq', value });
    return queryBuilder;
  };
  
  queryBuilder.in = (column: string, values: any[]) => {
    whereConditions.push({ column, op: 'in', value: values });
    return queryBuilder;
  };
  
  queryBuilder.order = (column: string, options?: { ascending?: boolean }) => {
    orderBy = { column, ascending: options?.ascending ?? true };
    return queryBuilder;
  };
  
  queryBuilder.limit = (count: number) => {
    limitCount = count;
    return queryBuilder;
  };
  
  queryBuilder.offset = (count: number) => {
    offsetCount = count;
    return queryBuilder;
  };
  
  queryBuilder.single = () => {
    isSingle = true;
    limitCount = 1;
    return queryBuilder;
  };
  
  queryBuilder.maybeSingle = () => {
    isSingle = true;
    limitCount = 1;
    return queryBuilder;
  };
  
  // 添加 then 方法，支持 await
  queryBuilder.then = async (resolve: any, reject?: any) => {
    try {
      const result = await execute();
      resolve(result);
    } catch (error) {
      if (reject) {
        reject(error);
      } else {
        resolve({ data: null, error });
      }
    }
  };
  
  return queryBuilder;
}
