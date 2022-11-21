import { createPool, CommonQueryMethods, sql } from 'slonik';
import { createQueryLoggingInterceptor } from "slonik-interceptor-query-logging";

function getPostgresUrl(): string {
    return process.env.POSTGRES_DSN || `postgres://${encodeURIComponent(process.env.PGUSER || 'postgres')}:${encodeURIComponent(process.env.PGPASSWORD || '')}@${
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
                date TIMESTAMP NOT NULL,
                value text NOT NULL
            );

            INSERT INTO test_table_bar
                (id, uid, value, date)
            VALUES
                (1, 'z', 'aaa', '2022-01-01'),
                (2, 'y', 'aaa', '2022-02-01'),
                (3, 'x', 'bbb', '2022-03-01'),
                (4, 'w', 'bbb', '2022-04-01'),
                (5, 'v', 'ccc', '2022-05-01'),
                (6, 'u', 'ccc', '2022-06-01'),
                (7, 't', 'ddd', '2022-07-01'),
                (8, 's', 'ddd', '2022-08-01'),
                (9, 'r', 'eee', '2022-09-01');
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
