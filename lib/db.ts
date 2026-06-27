import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Lazy-init to avoid build-time errors when DATABASE_URL is not set
let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Proxy that lazily delegates to the real sql function
const sql = new Proxy({} as NeonQueryFunction<false, false>, {
  get(_target, prop) {
    return (getSql() as any)[prop];
  },
  apply(_target, _thisArg, args) {
    return (getSql() as any)(...args);
  },
});

export default sql;
