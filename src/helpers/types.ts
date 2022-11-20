import { sql, QuerySqlToken } from 'slonik';

export type Fragment = ReturnType<typeof sql["fragment"]>;
export type { QuerySqlToken  as Query };
