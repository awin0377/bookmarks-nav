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
function sql(strings: TemplateStringsArray, ...values: unknown[]): any {
  return (getSql() as any)(strings, ...values);
}

// Expose query() for health-check style raw queries
sql.query = (q: string) => (getSql() as any).query(q);

export default sql;
