# slonik-trpc

[![Version](https://img.shields.io/npm/v/slonik-trpc?color=success)](https://www.npmjs.com/package/slonik-trpc)
![Coverage](coverage/badge.svg)
![License](https://img.shields.io/npm/l/slonik-trpc)

[Convert any SQL query](https://theartofpostgresql.com/blog/2019-09-the-r-in-orm) into an API.

## Usage

```sh
yarn add slonik-trpc
yarn add slonik@33 zod@3
```

```ts
import { sql } from 'slonik';
import { z } from 'zod';
import { makeQueryLoader } from 'slonik-trpc';

const loader = makeQueryLoader({
    db: slonikConnection, // any DB connection will do
    query: {
        select: sql.type(z.object({
            id: z.string(),
            name: z.string(),
            age: z.number(),
            // Any slonik query will do
		}))`
		SELECT id,
			name,
			EXTRACT(NOW() - created_at) AS age
		`,
        // The from fragment of the query is separated from the select portion.
        from: sql.fragment`FROM users`,
    }
});
```

Query this loader/API by selecting just the fields you need.

```ts
// The users type will return only id and age
const users = await loader.load({
    select: ["id", "age"],
    take: 200,
});
```

Read on for more advanced usage, including how to use sorting, filtering, cursor pagination, authorization checks, creating a tRPC API and more.

### List of features

- [x] Declarative [filtering API](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/filtering) (filter creation utils included!)
  - [x] Automatic support for `AND`, `NOT`, `OR` in all the filters
  - [x] Ability to add [authorization filters](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/authorization) based on user auth context.
- [x] [Select the fields](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/overfetching) you need, to avoid the overfetching problem.
  - [x] Fully type-safe, only selected fields are returned in the types. If no selects are specified, every field is returned.
- [x] Runtime validation of input (completely safe against unsanitized inputs).
- [x] Optional runtime validation of output (Your zod types can be executed against your result, including transforming the output fields with zod transformers).
- [x] [Virtual field](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/virtual-columns) declaration in typescript (fully type-safe + with async support).
- [x] [Declarative sorting](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/sorting) capabilities, with support for custom SQL sorting expressions
- [x] [Offset-based pagination](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/pagination).
- [x] [Cursor-based pagination](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/cursor-pagination).
  - [x] Reverse page support

### Requirements

TypeScript 4.5+
Slonik 33+
Zod 3+

### Demo

Here's a [demo](https://githubbox.com/ardsh/slonik-trpc/tree/main/examples/datagrid-example) example table in codesandbox, that utilizes a SQLite-compatible mode for generating the queries.

### [Documentation](https://ardsh.github.io/slonik-trpc/)

You can refer to [the documentation](https://ardsh.github.io/slonik-trpc/) for advanced use-cases and tutorials.

## Advanced Usage

### Custom queries

Let's say you want to add a custom sub-query as a field to your relation.
You can do this very easily.

```ts
const query = sql.type(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    authoredPosts: z.number(),
    created_at: z.string()
}))`SELECT *,
    -- Count all the posts of the user as a number
    (SELECT COUNT(*) FROM posts WHERE posts.author = users.id) AS "authoredPosts"`;
const fromFragment = sql.fragment`FROM users`;
```

Note this count sub-query will be called only when the authoredPosts selected. Otherwise the database won't execute it, ensuring optimal performance.

### [tRPC API](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/trpc)

Use `loader.getLoadArgs` for getting the tRPC query input zod type.

```ts
getUsers: publicProcedure
    .input(loader.getLoadArgs({
        disabledFilters: {
            // OR filters can be disabled on a public API
            OR: true,
        }
    }))
    .query(({ input, ctx }) => {
        return loader.loadPagination({
            ...input,
            ctx,
        });
    }),
```

Now it can be called via tRPC:

```ts
const users = await client.getUsers.query({
    select: ["id", "name", "email"], // Will query only these 3 columns, ignoring the rest
    take: 25,
    skip: 0,
});
```

This returns a relay-like pagination result, with `nodes` and `pageInfo` keys.

### Filtering

You can add any filter to the API, by specifying the filter type, and the interpreter function that converts the filter input to a SQL fragment, in a declarative way.

Here's an example:

```ts
import { createFilters, booleanFilter, arrayFilter, dateFilter, genericFilter } from 'slonik-trpc/utils';

const filters = createFilters<Context>()({
    // Specify the filter input types with zod types
    ids: z.union([z.string(), z.array(z.string())]),
    createdDate: z.object({
        _gt: z.string(),
        _lt: z.string(),
    }),
    // Whether the user has more than N posts
    postsCount: z.number(),
    name: z.string(),
    isGmail: z.boolean(),
    // Then the interpreter functions for each filter
}, {
    name: (value) => sql.fragment`name=${value}`,
    // If isGmail: true, return emails that end in gmail.com. If isGmail: false, return only non-gmail emails.
    isGmail: (value) => booleanFilter(value, sql.fragment`email ILIKE '%gmail.com'`),
    // Returns only ids in the array, if any elements are specified.
    ids: (value) => arrayFilter(value, sql.fragment`users.id`),
    // Using the previously declared sub-query
    postsCount: value => genericFilter(value, sql.fragment`"authoredPosts" > ${value}`),
    createdDate: (value) => dateFilter(value, sql.fragment`users.created_at`),
})

const loader = makeQueryLoader({
    db,
    query,
    filters,
});
```

As you can see, the filter creation is very easy, yet it offers very powerful, flexible and type-safe filters, giving you complete control over the resulting API that is created.

`arrayFilter`, `dateFilter`, and `booleanFilter` are small utilities that can be used to build sql fragments for common filters. You can look at [their implementation](https://github.com/ardsh/slonik-trpc/blob/main/src/helpers/sqlUtils.ts) if you wanna try creating your own.

`AND`, `OR` and `NOT` are the only filters are added automatically, to allow more complex combinations.

```ts
const specificUsers = await filtersLoader.load({
    where: {
        // users created between yesterday and now
        createdDate: {
            _lt: new Date().toISOString(),
            _gt: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
        },
        OR: [{
            // Returns users with these specific ids
            id: ['x', 'y'],
        }, {
            // or non-gmail users.
            isGmail: false,
        }, {
            // Or with less than 20 posts (by inverting the postsCount greater than filter)
            NOT: {
                postsCount: 20,
            }
        }]
    }
});
```

However, these too can be disabled (when calling `getLoadArgs`), and it is recommended to do so for the `OR` filter, which is often computationally expensive and shouldn't be allowed on a public API.

### Authorization

For authorization checks, use the `constraints` option to add hardcoded conditions to the query, based on the context.

```ts
const userLoader = makeQueryLoader({
    db,
    query,
    filters,
    constraints(ctx) {
        if (ctx.role === 'ADMIN') {
            // Allow admins to query anyone by returning no extra permission rules.
            return null;
        } else {
            // Only allow querying the users in the same org as the logged in user
            return sql.fragment`users.org_id=${ctx.orgId}`;
        }
    }
});
```

Constraints are like hardcoded filters that are always applied.
Any kind of SQL condition will do, and you can also return an array of multiple conditions, they will be joined with `AND`.

#### Postprocessing columns

If you need to check specific columns, you can virtualize them with the same name, and run any checks.

```ts
const virtualFieldsLoader = makeQueryLoader({
    query,
    virtualFields: {
        name: {
            resolve(row, ctx) {
                if (!ctx.isLoggedIn) {
                    // Return null if user isn't logged in.
                    return null;
                }
                return row.name;
            }
        },
        email: {
            resolve(row, ctx) {
                if (ctx.isAdmin) {
                    // Only return user emails if current user is admin.
                    return row.email;
                }
                return null;
            },
        },
    }
});
```

### Sorting

Define your sortable column aliases. You can use strings or sql fragments to identify the columns.

```ts
const sortableLoader = makeQueryLoader({
    query,
    sortableColumns: {
        id: sql.fragment`users.id`,
        name: "name",
        // All 3 methods are acceptable as long as the specified column is accessible from the FROM query and non-ambiguous
        createdAt: ["users", "created_at"],
    },
});

const sortedByName = await db.any(await sortableLoader.getQuery({
    orderBy: ["name", "ASC"],
}));

const sortedByNameAndDate = await db.any(await sortableLoader.getQuery({
    orderBy: [["name", "DESC"], ["id", "ASC"]],
    take: 5,
}))
```

If you don't specify any sortableColumns your API won't be sortable with orderBy.

If you specify a negative take, the order will be reversed, this is useful for getting the last page...

```ts
const lastPage = await db.any(await sortableLoader.getQuery({
    orderBy: [["name", "DESC"], ["id", "ASC"]],
    take: -25,
}));
```

### Grouping

You can add a `groupBy` fragment to your query, to be able to use aggregates in your select.

E.g. for getting the user's posts count, you can use

```ts
const groupedLoader = makeQueryLoader({
    query: {
        select: sql.type(z.object({
            count: z.number(),
            name: z.string(),
        }))`SELECT COUNT(*), users.name`,
        from: sql.fragment`FROM posts
            LEFT JOIN users
                ON posts.author = users.id`,
        groupBy: sql.fragment`users.name`,
    },
    filters: createFilters<Context>()({
        categories: z.union([z.string(), z.array(z.string())]),
    }, {
        // Filter based on posts category.
        categories: (value) => arrayFilter(value, sql.fragment`posts.category`),
    }),
});
```

Now you can easily filter authors by their posts, and still get the posts count.

```ts
const bigPostsCount = await sortableLoader.load({
    where: {
        categories: ["typescript"]
    },
});
// Returns counts of typescript posts for each user.
```

### Cursor-based pagination

If you've enabled any sorting columns, you can use cursor-based pagination with `cursur`. Simply specify the cursor of the item you'd like to paginate after.

```ts
const usersAfterBob = await db.any(await sortableLoader.getQuery({
    orderBy: [["name", "DESC"], ["id", "ASC"]],
    cursor: "eyJuYW1lIjoiQm9iIiwiaWQiOjQ1fQ==",
    take: 5,
}));
```

#### Manual cursor-based pagination

You can also do prisma-style cursor pagination by supplying the values yourself.

```ts
const usersAfterBob = await db.any(await sortableLoader.getQuery({
    orderBy: [["name", "DESC"], ["id", "ASC"]],
    searchAfter: {
        name: "Bob",
        id: 45,
    },
    take: 5,
}))
```

This is equivalent to the above example, since `eyJuYW1lIjoiQm9iIiwiaWQiOjQ1fQ==` base64 decoded is `{"name":"Bob","id":45}`.

### Virtual fields

Virtual fields are only supported when using `load`/`loadPagination` currently.

```ts
const virtualFieldsLoader = makeQueryLoader({
    query,
    virtualFields: {
        fullName: {
            dependencies: ["first_name", "last_name"],
            async resolve(row) {
                // async code supported
                return Promise.resolve(row.first_name + row.last_name);
            },
        },
    }
});
```

The virtual fields can then be selected like normal fields.

### Nested arrays and objects

You can use PostgreSQL functions for creating json arrays and objects in your query. Two such utils are exposed for convenience through `rowToJson` and `rowsToArray`.

```ts
import { rowToJson, rowsToArray } from 'slonik-trpc/utils';

const query = sql.type(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    contactInfo: z.object({
        phoneNumber: z.string(),
        zip: z.string(),
        address: z.string(),
    }),
    posts: z.array(z.object({
        text: z.string(),
        title: z.string(),
    })),
}))`SELECT
    users.id,
    name,
    email,
    ${rowToJson(sql.fragment`
        SELECT "phoneNumber", "zip", "address"
        WHERE contact_info.id IS NOT NULL
    `, 'contactInfo')}
    ${rowsToArray(sql.fragment`
        SELECT text, title`, sql.fragment`
        FROM posts
        WHERE posts.author = users.id`,
        'posts'
    )}
FROM users
LEFT JOIN contact_info
ON contact_info.id = users.contact_info`;
```

If you wanna prevent conflicts of field names when joining multiple tables, it's recommended to wrap the whole query in a `SELECT * FROM (subQuery) alias`, which has the effect of returning only a single view, thus making conflicts impossible.

Refer to the [minimal-example](https://stackblitz.com/github/ardsh/slonik-trpc/tree/main/examples/minimal-trpc), or [datagrid-example](https://githubbox.com/ardsh/slonik-trpc/tree/main/examples/datagrid-example) for more complete examples.

## FAQ

### I don't wanna switch database clients (e.g. I'm already using Prisma client)

This is not officially supported, but you can actually provide any function to the `db` loader argument. Then you won't have to setup slonik client and can use another one like prisma client, as long as it's able to send SQL queries.
So with prisma you can write the following when creating the loader:

```ts
export const loader = makeQueryLoader({
    query,
    db: {
        any: (sql) => {
            return prisma.$queryRawUnsafe(sql.sql, ...sql.values);
        }
    },
    // ...
```

You still need to install slonik and zod though, for composing query fragments with. Since the SQL string is generated from slonik, it's completely safe from SQL injection, so it's safe to be used with `prisma.$queryRawUnsafe`.

It is likely you will run into issues doing this though, so using the slonik package as a client is recommended. [Refer to the documentation](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/slonik) for a minimal setup example of slonik client.

### Can I use custom SQL views or sub-queries

Yes, any PostgreSQL query is supported. So you can do anything that is allowed in PostgreSQL, e.g. to get postCount of users directly in a sub-query do

```sql
SELECT id
  , name
  , (SELECT COUNT(*) FROM posts WHERE users.id = posts.author_id) AS postCount
  , email
  , created_at
FROM users
```

### Why do I have to declare both zod types and SQL queries 

It is theoretically possible to infer the zod type from the SQL query you write.
E.g. [@slonik/typegen](https://github.com/mmkal/slonik-tools/tree/main/packages/typegen) generates typescript types.

Let me know if there already are packages that convert PostgreSQL queries to zod types, we can try to make them compatible and easier to work with the query loaders.

This is a good issue to contribute on. All help is welcome!

### Can I see the SQL queries that are being executed

If you mean debugging during runtime, you can do `export DEBUG=slonik-trpc`.
You can also run `getQuery` with the same parameters as `load/loadPagination`, and it will return the raw SQL query without executing anything.

This is useful for many reasons, e.g. if you want to analyze a slow query, you can measure the time it takes to run, and then print out the SQL for any queries that are slower than a threshold.

Note that `loadPagination` will run an extra query for getting the total count, if you specify `takeCount: true`. This is the same query as returned by getQuery, but wrapped in a `SELECT COUNT` query like

```sql
SELECT COUNT(*) FROM (...) subQuery
```

### Can this be used as an ORM

Many features of ORMs, such as updating data, aren't supported at all by this package.

However, this package can be integrated with any ORM that supports executing raw queries, such as [prisma](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access).

So you can use them both at the same time, by using slonik-trpc to build a type-safe yet flexible read-only API, and use the ORM for the rest.

## Known issues

If you're passing a select array conditionally, typescript type inference doesn't allow getting the underlying type correctly. You'll have to use type assertions in that case, use `as any` if one condition has an empty array/undefined to get all the fields returned properly. Otherwise typescript will only return id/name.

```ts
const data = await loader.load({
    select: someCondition ? ['id', 'name'] : [] as any
})
```

Do not pass any conditions after the select ... from statement. If you must run custom SQL conditions in your queries, simply wrap them in a sub-query

```ts
const query = sql.type(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    created_at: z.string()
}))`SELECT * FROM (
    SELECT id, name, email, created_at
    FROM users
    WHERE users.created_at > NOW() - INTERVAL '1 month'
    ORDER BY users.created_at
) x`;
```

### Inferring returned types in the clientside

Due to [typescript limitations](https://github.com/trpc/trpc/discussions/2150) it's not possible to infer the returned types automatically in the clientside with trpc. So all fields will be selected by default, even if you only select a few.

To get around this, you can use `InferPayload` and pass the arguments as a generic argument.

server
```ts
import type { InferPayload, InferArgs } from 'slonik-trpc';

const postsLoader = makeQueryLoader(...);

type PostLoader = typeof postsLoader;

export type {
    InferPayload, InferArgs, PostLoader
}
```

client
```ts
const getPosts = <TArgs extends InferArgs<PostLoader>>(args: TArgs) => {
    return client.loadPosts.query(args) as Promise<InferPayload<PostLoader, TArgs>[]>;
}
```

Or with hooks + loadPagination and a useful type annotation to replace the pagination `nodes` key easily.

```ts
import type { InferArgs, InferPayload, Post } from '../../server';

type ReplaceNodes<TResult, TPayload> = TResult extends { nodes?: ArrayLike<any>, hasNextPage?: boolean } ? Omit<TResult, "nodes"> & {
    nodes: TPayload[]
} : TResult extends object ? {
    [K in keyof TResult]: ReplaceNodes<TResult[K], TPayload>
} : TResult;

const getPosts = <TArgs extends InferArgs<PostLoader>>(args: TArgs) => {
    const result = trpc.loadPosts.useQuery(args);
    return result as ReplaceNodes<typeof result, InferPayload<PostLoader, TArgs>>;
}
```

You don't need to do this if your selects are dynamic, in that case simply consider all fields optional.

Also this is not necessary when querying the loader directly in the serverside, in those cases fields will be automatically inferred depending on your selections.

There are more advanced patterns to support [relay-like fragment selections](https://dev.to/ardsh/how-to-solve-overfetching-with-trpc-apis-when-rendering-tables-pt-1-fbg), or [cursor pagination](https://ardsh.github.io/slonik-trpc/docs/client-type-safety/cursor-pagination) that allows rendering each table column in a type-safe method.

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](issues).

### Testing

Export your postgres database URL, then run `yarn test`

```bash
export DATABASE_URL=postgresql://postgres:password@localhost:5432/database
yarn test
```

### Ideas

- Prisma generator similar to [zod-prisma](https://github.com/CarterGrimmeisen/zod-prisma) that automatically creates data loaders from prisma schemas.
- Automatically syncing the zod types with sql, using something like [@slonik/typegen](https://github.com/mmkal/slonik-tools/tree/main/packages/typegen)
- Wildcards in selects, e.g. `select: ["name*"]` to select all fields that start with name.
- Custom loaders and/or plugins/middlewares for processing query results.
- Mutations, through an update API builder.
  - Furthermore, building an entire CRUD tRPC API, by only requiring you to declare small SQL fragments and their zod types. Similar to hasura.
- ~~Integration with [prisma client raw database access](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access), and other DB clients, separating data loading from query composition.~~ [Done](https://github.com/ardsh/slonik-trpc/blob/main/examples/datagrid-example/src/server/db/loaders/employeeLoader.ts).

## 📝 License

Copyright © 2023 [ardsh](https://github.com/ardsh).<br />
This project is [MIT](LICENSE) licensed.
