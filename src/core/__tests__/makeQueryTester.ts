import { DatabasePool, createPool, CommonQueryMethods, sql } from 'slonik';
import { createQueryLoggingInterceptor } from "slonik-interceptor-query-logging";

function getPostgresUrl(): string {
    return `postgres://${encodeURIComponent(process.env.PGUSER || 'postgres')}:${encodeURIComponent(process.env.PGPASSWORD || '')}@${
        process.env.PGHOST || '0.0.0.0'
    }:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'postgres'}`;
}

export function makeQueryTester() {
    const pool = createPool(getPostgresUrl(), {
        interceptors: [createQueryLoggingInterceptor()],
    });
    const db: CommonQueryMethods = new Proxy({} as never, {
        get(target, prop: keyof CommonQueryMethods) {
            return (...args: any[]) => {
                return pool.then(db => {
                    return Function.prototype.apply.apply(db[prop], [db, args]);
                });
            }
        },
    });

    beforeAll(async () => {
        await (await pool).query(sql.unsafe`
            CREATE TABLE IF NOT EXISTS test_table_bar (
                id integer NOT NULL PRIMARY KEY,
                uid text NOT NULL,
                value text NOT NULL
            );

            INSERT INTO test_table_bar
                (id, uid, value)
            VALUES
                (1, 'z', 'aaa'),
                (2, 'y', 'aaa'),
                (3, 'x', 'bbb'),
                (4, 'w', 'bbb'),
                (5, 'v', 'ccc'),
                (6, 'u', 'ccc'),
                (7, 't', 'ddd'),
                (8, 's', 'ddd'),
                (9, 'r', 'eee');
        `);
    });

    afterAll(async () => {
        await (await pool).query(sql.unsafe`
            DROP TABLE IF EXISTS test_table_bar;
        `);

        await (await pool).end();
    });
    return {
        db,
    };
}
