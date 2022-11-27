# slonik-trpc

`slonik-trpc` is a simple utility for creating type-safe querying APIs with SQL queries, using [slonik](https://github.com/gajus/slonik) and [zod](https://github.com/colinhacks/zod).

This can make API creation very easy and flexible, especially for [tRPC](https://github.com/trpc/trpc) queries, while remaining very efficient and secure, thanks to slonik and zod.

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

### Overfetching

You can specify which fields you'd like to query, and only those will be queried, to prevent overfetching.

```ts
const data = await slonik.query(loader.getQuery({
    select: ["id", "name"]
}));
```

You can also exclude specific fields, especially if they're doing heavy joins.

```ts
const data = await slonik.query(loader.getQuery({
    // All other fields will be returned
    exclude: ["complexField"],
}));
```

### Usage with trpc

To use it in trpc declare a query and pass the input.

```ts
input: loader.getLoadArgs(),
async resolve({ ctx, input }) {
    return loader.loadOffsetPagination({
        ...input,
        context: ctx,
    });
}
```

You don't have to use loadOffsetPagination/load if you're using `getQuery`, and can execute the query yourself. The returned query data will still be type-safe.

```ts
async resolve({ ctx, input }) {
    return slonik.query(loader.getQuery({
        ...input,
        context: ctx,
    }));
}
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

### Virtual fields

Virtual fields are only supported when using `load`/`loadOffsetPagination` currently.

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

The virtual fields can then be selected/excluded like normal fields.

Refer to the [playground file](./src/core/__tests__/playground.test.ts) for more examples.

## Features

- [x] Declarative filtering API (filter creation utils included!)
  - [x] Automatic support for AND, NOT, OR in all the filters
  - [x] Ability to add authorization filters based on user auth context.
- [x] Selecting/excluding columns, to avoid the overfetching problem.
- [x] Runtime validation of input.
- [x] Virtual fields (fully type-safe).
- [x] Post-processing with javascript functions.
- [x] Offset-based pagination.
- [ ] Cursor-based pagination (TODO).

## Installation

### Requirements

TypeScript 4.5+
Slonik 33+

```bash
yarn add slonik-trpc
```

## Known issues

If you're passing a select/exclude array conditionally, typescript type inference doesn't allow getting the underlying type correctly. You'll have to use type assertions in that case, use `as any` if one condition has an empty array/undefined to get all the fields returned properly. Otherwise typescript will only return id/name.

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

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](issues).

## 📝 License

Copyright © 2022 [ardsh](https://github.com/ardsh).<br />
This project is [MIT](LICENSE) licensed.
