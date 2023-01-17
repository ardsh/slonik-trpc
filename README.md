# slonik-trpc

`slonik-trpc` is a simple utility for creating type-safe querying APIs with SQL queries, using [slonik](https://github.com/gajus/slonik) and [zod](https://github.com/colinhacks/zod).

This can make API creation very easy and flexible, especially for [tRPC](https://github.com/trpc/trpc) queries, while remaining very efficient and secure, thanks to slonik and zod.

## Features

- [x] Declarative [filtering API](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/filtering) (filter creation utils included!)
  - [x] Automatic support for `AND`, `NOT`, `OR` in all the filters
  - [x] Ability to add [authorization filters](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/authorization) based on user auth context.
- [x] [Select the fields](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/overfetching) you need, to avoid the overfetching problem.
  - [x] Fully type-safe, only selected fields are returned in the types.
- [x] Runtime validation of input (completely safe against unsanitized inputs).
- [x] [Virtual field](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/virtual-columns) declaration in typescript (fully type-safe + with async support).
- [x] [Declarative sorting](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/sorting) capabilities, with support for custom SQL sorting expressions
- [x] [Offset-based pagination](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/pagination).
- [x] [Cursor-based pagination](https://ardsh.github.io/slonik-trpc/docs/usage-main-features/cursor-pagination).
  - [x] Reverse page support

## Installation

### Requirements

TypeScript 4.5+
Slonik 33+
Zod 3+

```bash
yarn add slonik-trpc
```

## Usage

Declare the query as you would normally with slonik.

```ts
const query = sql.type(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    created_at: z.string()
}))`SELECT id, name, email, created_at FROM users`;
```

Now this can be used to create a type-safe API.

```ts
const loader = makeQueryLoader({
    db: slonikConnection,
    query,
});
```

### [Documentation](https://ardsh.github.io/slonik-trpc/)

You can refer to [the documentation](https://ardsh.github.io/slonik-trpc/) for advanced use-cases and tutorials.

### Overfetching

You can specify which fields you'd like to query, and only those will be queried, to prevent overfetching.

```ts
const data = await slonik.query(loader.getQuery({
    select: ["id", "name"]
}));
```

You can also group columns together, to make selections easier

```ts
const loader = makeQueryLoader({
    columnGroups: {
        basic: ["id", "name"],
    },
    db: slonikConnection,
    query,
});
const data = await slonik.query(loader.getQuery({
    selectGroups: ["basic"], // Returns only id and name
}));
```

### Usage with trpc

To use it in trpc declare a query and pass the input.

```ts
loadUsers: publicProcedure
    .input(loader.getLoadArgs())
    .query(({ ctx, input }) => {
        return loader.loadPagination({
            ...input,
            ctx,
        });
    })
```

You don't have to use loadPagination/load if you're using `getQuery`, and can execute the query yourself. The returned query data will still be type-safe.

```ts
.query(({ input, ctx }) => {
    return slonik.query(loader.getQuery({
        ...input,
        ctx,
    }));
}),
```

### Filtering

```ts
import { createFilters, booleanFilter, arrayFilter, dateFilter } from 'slonik-trpc/utils';

const filters = createFilters<Context>()({
    // Specify the filter input types with zod types
    id: z.union([z.string(), z.array(z.string())]),
    createdDate: z.object({
        _gt: z.string(),
        _lt: z.string(),
    }),
    name: z.string(),
    isGmail: z.boolean(),
    // Then the interpreter functions for each filter
}, {
    name: (value) => sql.fragment`name=${value}`,
    // If isGmail: true, return emails that end in gmail.com. If isGmail: false, return only non-gmail emails.
    isGmail: (value) => booleanFilter(value, sql.fragment`email ILIKE '%gmail.com'`),
    // Returns only ids in the array, if any elements are specified.
    id: (value) => arrayFilter(value, sql.fragment`users.id`),
    createdDate: (value) => dateFilter(value, sql.fragment`users.created_at`),
})

const loader = makeQueryLoader({
    query,
    filters,
});
```

`arrayFilter`, `dateFilter`, and `booleanFilter` are small utilities that can be used to build sql fragments for common filters.

These filters can then be used when calling the API. `AND`, `OR` and `NOT` filters are added automatically, to allow more complex conditions.

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
        }]
    }
});
```

### Authorization

For authorization checks, use the postprocess filter option to add hardcoded conditions to the query, based on the context.

```ts
const filters = createFilters<Context>()({
    ...filters
}, {
    ...interpreters
}, {
    postprocess(conditions, filters, ctx) {
        // Using postprocessing of filters to add an authorization check
        conditions.push(sql.fragment`users.id=${ctx.userId}`);
        // All conditions are joined with AND
        return conditions;
    },
})
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

const sortedByName = await db.any(sortableLoader.getQuery({
    orderBy: ["name", "ASC"],
}));

const sortedByNameAndDate = await db.any(sortableLoader.getQuery({
    orderBy: [["name", "DESC"], ["id", "ASC"]],
    take: 5,
}))
```

If you don't specify any sortableColumns your API won't be sortable with orderBy.

If you specify a negative take, the order will be reversed, this is useful for getting the last page...

```ts
const lastPage = await db.any(sortableLoader.getQuery({
    orderBy: [["name", "DESC"], ["id", "ASC"]],
    take: -25,
}));
```

### Cursor-based pagination

If you've enabled any sorting columns, you can use cursor-based pagination with `cursur`. Simply specify the cursor of the item you'd like to paginate after.

```ts
const usersAfterBob = await db.any(sortableLoader.getQuery({
    orderBy: [["name", "DESC"], ["id", "ASC"]],
    cursor: "eyJuYW1lIjoiQm9iIiwiaWQiOjQ1fQ==",
    take: 5,
}));
```

#### Manual cursor-based pagination

You can also do prisma-style cursor pagination by supplying the values yourself.

```ts
const usersAfterBob = await db.any(sortableLoader.getQuery({
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

Refer to the [minimal-example](https://stackblitz.com/github/ardsh/slonik-trpc/tree/main/examples/minimal-trpc), or [datagrid-example](https://stackblitz.com/github/ardsh/slonik-trpc/tree/main/examples/datagrid-example) for more complete examples.


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

Or with hooks + loadPagination and a useful type annotation to replace the pagination `edges` key easily.

```ts
import type { InferArgs, InferPayload, Post } from '../../server';

type ReplaceEdges<TResult, TPayload> = TResult extends { edges?: ArrayLike<any>, hasNextPage?: boolean } ? Omit<TResult, "edges"> & {
    edges: TPayload[]
} : TResult extends object ? {
    [K in keyof TResult]: ReplaceEdges<TResult[K], TPayload>
} : TResult;

const getPosts = <TArgs extends InferArgs<PostLoader>>(args: TArgs) => {
    const result = trpc.loadPosts.useQuery(args);
    return result as ReplaceEdges<typeof result, InferPayload<PostLoader, TArgs>>;
}
```

You don't need to do this if your selects are dynamic, in that case simply consider all fields optional.

Also this is not necessary when querying the loader directly in the serverside, in those cases fields will be automatically inferred depending on your selections.

There are more advanced patterns to support relay-like fragment selections, or tabular data loading that allows rendering each table column in a type-safe method.

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
- Integration with [prisma client raw database access](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access), and other DB clients, separating data loading from query composition.

## 📝 License

Copyright © 2023 [ardsh](https://github.com/ardsh).<br />
This project is [MIT](LICENSE) licensed.
