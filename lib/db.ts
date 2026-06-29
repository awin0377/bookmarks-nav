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
function sql(strings: TemplateStringsArray, ...values: unknown[]): any {
  const fn = getSql() as any;
  return fn(strings, ...values);
}

// Expose query() for health-check style raw queries
sql.query = (q: string, params?: any[]) => (getSql() as any)(q, params ?? []);

export default sql;
