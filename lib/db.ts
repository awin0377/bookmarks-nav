import { neon } from '@neondatabase/serverless';

// Module-level cache — initialized on first use
let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Thin wrapper: tagged template literal → delegates to real sql
// Avoids Proxy which breaks in some bundlers (e.g. Next.js serverless)
function sql(strings: TemplateStringsArray | string, ...values: unknown[]): any {
  const fn = getSql() as any;
  if (typeof strings === 'string') {
    // Ordinary function call: sql("SELECT ...", [param1, param2])
    // The first (and only) rest value is the params array; spread it
    const params = values[0];
    if (Array.isArray(params) && params.length > 0) {
      return fn(strings, ...params);
    }
    return fn(strings);
  }
  return fn(strings, ...values);
}

// Expose query() for health-check style raw queries
sql.query = (q: string, params?: any[]) => (getSql() as any)(q, params ?? []);

export default sql;
