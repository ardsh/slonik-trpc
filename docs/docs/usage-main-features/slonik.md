---
sidebar_position: 20
---

# Slonik

This is an abbreviated guide to get started with slonik for the purposes of this tutorial, which is just a toy example.

You can also skip this step if you get started with the [minimal-example playground](https://stackblitz.com/github/ardsh/slonik-trpc/tree/main/examples/minimal-trpc)

You should refer to [slonik's comprehensive documentation](https://github.com/gajus/slonik#usage) for more advanced use cases.


## PostgreSQL

This is a good starting point for getting [free PostgreSQL database in the cloud](https://hasura.io/blog/top-postgresql-database-free-tier-solutions/)

Create a database in [Neon](https://neon.tech/), then export the DATABASE_URL by putting it in your .env file.

## Connecting

Install slonik

```bash
yarn add slonik
```

Create a file at `src/slonik.ts`:

```ts title="src/slonik.ts"
import { CommonQueryMethods, createPool, createTypeParserPreset, sql } from 'slonik';
import { createResultParserInterceptor } from "slonik-trpc/utils";

export const slonik = createPool(process.env.POSTGRES_DSN || process.env.DATABASE_URL, {
    interceptors: [createResultParserInterceptor()],
    typeParsers: [
    ...createTypeParserPreset().filter(
        (a) => a.name !== "timestamp" && a.name !== "timestamptz" && a.name !== "date"
    ), {
        name: "date",
        parse: (a) => !a || !Date.parse(a) ? a :
            new Date(a).toISOString().slice(0, 10),
    }, {
        name: "timestamptz",
        parse: (a) => !a || !Date.parse(a) ? a : new Date(a).toISOString(),
    }, {
        name: "timestamp",
        parse: (a) => !a || !Date.parse(a) ? a : new Date(a + "Z").toISOString(),
    }],
})

// If you're using ES modules with node 14+ you can use top-level await here
// export const db = await slonik;
export const db: CommonQueryMethods = new Proxy({} as never, {
    get(target, prop: keyof CommonQueryMethods) {
        return (...args: any[]) => {
            return pool.then((db) => {
                return Function.prototype.apply.apply(db[prop], [db, args]);
            });
        };
    },
});
```

We're adding specific type parsers for the timestamp/date types to make it easier by returning ISO strings, slonik returns int timestamps by default.

The DATABASE_URL env variable should take the form of `postgresql://user:password@host:port/database`

## Creating the database schema

If you'd like to create the database schema for this tutorial in SQL, simply create a `schema.ts` file.

```ts title="src/schema.ts"
import { db } from './slonik.ts';

export async function initializeDatabase(schema?: string) {
    if (schema) {
        await db.query(sql.unsafe`
            CREATE SCHEMA IF NOT EXISTS ${sql.identifier([schema])};
            SET search_path TO ${sql.identifier([schema])};
        `);
    }
    await db.query(sql.unsafe`
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
    await db.query(sql.unsafe`
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

initializeDatabase('playground');
```
