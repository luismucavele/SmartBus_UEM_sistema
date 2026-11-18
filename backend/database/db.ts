import mysql from "mysql2/promise";

const isLocal = !process.env.DB_HOST || process.env.DB_HOST === "127.0.0.1" || process.env.DB_HOST === "localhost";
const useSsl = process.env.DB_SSL === "true" || process.env.DB_SSL === "1" || !isLocal;

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "smartbus_uem",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  timezone: process.env.DB_TIMEZONE || "Africa/Maputo",
  ssl: useSsl ? { minVersion: "TLSv1.2", rejectUnauthorized: false } : undefined,
});

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function checkDatabase() {
  await pool.query("SELECT 1");
  return true;
}

export default pool;
