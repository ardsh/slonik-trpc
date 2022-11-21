import { sql, QuerySqlToken } from 'slonik';

export type Fragment = ReturnType<typeof sql["fragment"]>;
export type { QuerySqlToken  as Query };


type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
export type RemoveAny<T> = IfAny<T, null, T>;
