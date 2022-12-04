// prettier-ignore
import { CommonQueryMethods, createPool, createTypeParserPreset, sql } from 'slonik';

import { createResultParserInterceptor } from "slonik-trpc/utils";

export function getPostgresUrl(): string {
    return (
        process.env.DATABASE_URL ||
        process.env.POSTGRES_DSN ||
        `postgres://${encodeURIComponent(
            process.env.PGUSER || "postgres"
        )}:${encodeURIComponent(process.env.PGPASSWORD || "")}@${
            process.env.PGHOST || "0.0.0.0"
        }:${process.env.PGPORT || "5432"}/${
            process.env.PGDATABASE || "postgres"
        }`
    );
}

const pool = createPool(getPostgresUrl(), {
    maximumPoolSize: 1,
    idleTimeout: 40000,
    connectionTimeout: 30000,
    interceptors: [createResultParserInterceptor()],
    typeParsers: [
        ...createTypeParserPreset().filter(
            (a) => a.name !== "timestamp" && a.name !== "timestamptz"
        ),
        {
            name: "date",
            parse: (a) =>
                !a || !Date.parse(a)
                    ? a
                    : new Date(a).toISOString().slice(0, 10),
        },
        {
            name: "timestamptz",
            parse: (a) =>
                !a || !Date.parse(a) ? a : new Date(a).toISOString(),
        },
        {
            name: "timestamp",
            parse: (a) =>
                !a || !Date.parse(a) ? a : new Date(a + "Z").toISOString(),
        },
    ],
});

export const db: CommonQueryMethods = new Proxy({} as never, {
    get(target, prop: keyof CommonQueryMethods) {
        return (...args: any[]) => {
            return pool.then((db) => {
                return Function.prototype.apply.apply(db[prop], [db, args]);
            });
        };
    },
});

async function initializeDatabase(schema?: string) {
    if (schema) {
        await (await pool).query(sql.unsafe`
            CREATE SCHEMA IF NOT EXISTS ${sql.identifier([schema])};
            SET search_path TO ${sql.identifier([schema])};
        `);
    }
    await (await pool).query(sql.unsafe`
        DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS posts;

        CREATE TABLE IF NOT EXISTS posts (
            id integer NOT NULL PRIMARY KEY,
            author_id text NOT NULL,
            title text NOT NULL,
            date date NOT NULL,
            content text NOT NULL DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            "id" text NOT NULL PRIMARY KEY,
            "first_name" text NOT NULL,
            "last_name" text NOT NULL,
            "email" text NOT NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );`);
    await (await pool).query(sql.unsafe`
        INSERT INTO posts
            (id, author_id, title, content, date)
        VALUES
            (1, 'z', 'aaa', 'This is a post', '2022-01-01'),
            (2, 'y', 'aaa', 'This is a post', '2022-02-01'),
            (3, 'x', 'bbb', 'This is a post', '2022-03-01'),
            (4, 'w', 'bbb', 'This is a post', '2022-04-01'),
            (5, 'v', 'ccc', 'This is a post', '2022-05-01'),
            (6, 'u', 'ccc', 'This is a post', '2022-06-01'),
            (7, 't', 'ddd', 'This is a post', '2022-07-01'),
            (8, 's', 'ddd', 'This is a post', '2022-08-01'),
            (9, 'r', 'eee', 'This is a post', '2022-09-01');

        INSERT INTO users
            (id, "first_name", "last_name", email)
        VALUES
            ('z', 'Haskell', 'Nguyen', 'haskell04@gmail.com'),
            ('y', 'Padberg', 'Fletcher', 'padberg.shawna@hotmail.com'),
            ('x', 'Neal', 'Phillips', 'nvandervort@collier.com'),
            ('w', 'Nolan', 'Muller', 'qnolan@yahoo.com'),
            ('v', 'Bob', 'Dean', 'acummerata@gmail.com'),
            ('u', 'Rebecca', 'Mercer', 'moore.rebeca@yahoo.com'),
            ('t', 'Katheryn', 'Ritter', 'katheryn89@hotmail.com'),
            ('s', 'Dulce', 'Espinoza', 'dulce23@gmail.com'),
            ('r', 'Paucek', 'Clayton', 'paucek.deangelo@hotmail.com');
    `);
}

initializeDatabase().catch(err => console.error(err));
