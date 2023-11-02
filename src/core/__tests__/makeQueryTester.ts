import { createPool, CommonQueryMethods, sql, ClientConfiguration } from 'slonik';
import { createQueryLoggingInterceptor } from "slonik-interceptor-query-logging";
import { createResultParserInterceptor } from '../../utils';

export function getPostgresUrl(): string {
    const defaultUrl = `postgres://${encodeURIComponent(process.env.PGUSER || 'postgres')}:${encodeURIComponent(process.env.PGPASSWORD || '')}@${
        process.env.PGHOST || '0.0.0.0'
    }:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'postgres'}`;
    return process.env.POSTGRES_DSN || defaultUrl;
}

export function makeQueryTester(namespace?: string, options?: Partial<ClientConfiguration>) {
    const pool = createPool(getPostgresUrl(), {
        ...options,
        interceptors: [
            ...(options?.interceptors || []),
            createQueryLoggingInterceptor(),
            createResultParserInterceptor(),
        ],
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

    const setup = async () => {
        if (namespace) {
            await (await pool).query(sql.unsafe`
                CREATE SCHEMA IF NOT EXISTS ${sql.identifier([namespace])};
                SET search_path TO ${sql.identifier([namespace])};
            `);
        }
        await (await pool).query(sql.unsafe`
            CREATE TABLE IF NOT EXISTS test_table_bar (
                id integer NOT NULL PRIMARY KEY,
                uid text NOT NULL,
                date TIMESTAMP NOT NULL,
                value text NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                "id" text NOT NULL PRIMARY KEY,
                "first_name" text NOT NULL,
                "last_name" text NOT NULL,
                "email" text NOT NULL,
                "date_of_birth" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

            INSERT INTO users
                (id, "first_name", "last_name", email, "date_of_birth")
            VALUES
                ('z', 'Haskell', 'Nguyen', 'haskell04@gmail.com', '1990-01-01'),
                ('y', 'Padberg', 'Fletcher', 'padberg.shawna@hotmail.com', '1991-02-01'),
                ('x', 'Neal', 'Phillips', 'nvandervort@collier.com', '1992-03-01'),
                ('w', 'Nolan', 'Muller', 'qnolan@yahoo.com', '1993-04-01'),
                ('v', 'Bob', 'Dean', 'acummerata@gmail.com', '1994-05-01'),
                ('u', 'Rebecca', 'Mercer', 'moore.rebeca@yahoo.com', NULL),
                ('t', 'Katheryn', 'Ritter', 'katheryn89@hotmail.com', NULL),
                ('s', 'Dulce', 'Espinoza', 'dulce23@gmail.com', NULL),
                ('r', 'Paucek', 'Clayton', 'paucek.deangelo@hotmail.com', NULL);
        `);
    };
    if ((global as any).beforeAll) {
        beforeAll(setup);
    }

    const teardown = async () => {
        await (await pool).query(sql.unsafe`
            DROP TABLE IF EXISTS test_table_bar;
            DROP TABLE IF EXISTS users;
        `);
        if (namespace) {
            await (await pool).query(sql.unsafe`
                DROP SCHEMA IF EXISTS ${sql.identifier([namespace])} CASCADE;
            `);
        }

        await (await pool).end();
    };
    if ((global as any).afterAll) {
        afterAll(teardown);
    }
    return {
        db,
        setup,
        teardown,
    };
}
