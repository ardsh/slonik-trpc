import type { QuerySqlToken, FragmentSqlToken, SerializableValue } from 'slonik';

export type Fragment = FragmentSqlToken;
export type { QuerySqlToken  as Query, SerializableValue };


type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
export type RemoveAny<T> = IfAny<T, null, T>;

export type PromiseOrValue<T> = T | Promise<T>;
