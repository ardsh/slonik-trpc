---
sidebar_position: 7
---

# Filtering

Filtering in slonik-trpc allows you to specify which data you want to receive from the database. Once you declare the filters, complex combinations using AND, OR and NOT will be available automatically.

### Simple filter

Here is an example of how to build a simple filter:

```ts
createFilter<Context>()({
    id: z.string(),
}, {
    id: (value) => sql.fragment`users.id = ${value}`
});
```

This filter will accept a string as an `id`, and add a condition to the main query.
So passing the following `where` object:

```ts
where: {
    id: 5
}
```

Will result in a condition like

```sql
WHERE users.id = 5
```

Since we're using zod, it's not possible to pass anything but a string in that filter.

Suppose we want to query multiple users though. The API builder automatically adds `AND`, `OR` and `NOT` clauses, so this is possible

```ts
where: {
    OR: [{
        id: 5,
    }, {
        id: 6
    }]
}
```

In SQL it will correspond to this condition (though you don't have to worry about that)

```sql
WHERE ((users.id = 5) OR (users.id = 6))
```

### Filtering with arrays of id

To make it easier to query multiple IDs at once, you can use the `arrayFilter` utility function. Here is an example of how to use it:

```ts
createFilter<Context>()({
    ids: z.array(z.string()),
}, {
    ids: (values) => sql.fragment`users.id = ANY(${sql.array(values, 'text')})`
});
```

Using the `arrayFilter` utility for this kind of filter makes it easier to declare. For example:

```ts
createFilter<Context>()({
    ids: arrayStringFilterType,
}, {
    ids: (values) => arrayFilter(values, sql.fragment`users.id`)
});
```

Then, to use the filter, you can pass an `ids` array to the `where` object:

```ts
where: {
    ids: [3, 4, 5]
}
```

This will produce an SQL condition like the following:

```sql
WHERE users.id = ANY([3,4,5]::text[])
```

### Using the booleanFilter utility

The `booleanFilter` utility takes in a fragment and applies it if the input is true. It applies the reverse if the input is `false`, and doesn't apply anything if the input is `null`/`undefined`.

```ts
const filters = createFilters()({
    isGmail: z.boolean(),
}, {
    isGmail: (value) => booleanFilter(value, `users.email ILIKE '%gmail.com'`),
});
```

To use the filter, you can pass an `isGmail` value to the `where` object:

```ts
const nonGmailUsers = await filtersLoader.load({
    where: {
        isGmail: false,
    }
});
```

This will return only users that have their email ending in gmail.com.

The equivalent SQL would be

```sql
WHERE NOT(email ILIKE '%gmail.com')
```

### Merging filters

A good method of organization might be to declare filters based on the tables they access, e.g. `users` filters, `posts` filters, etc., then merge them at the end.


```ts
const userFilters = createFilters()({
    isGmail: z.boolean(),
    userIds: arrayStringFilterType,
}, {
    userIds: (values) => arrayFilter(values, sql.fragment`users.id`),
    isGmail: (value) => booleanFilter(value, `users.email ILIKE '%gmail.com'`),
});

const postFilters = createFilters()({
    postIds: arrayStringFilterType,
    longPost: z.boolean(),
}, {
    postIds: (values) => arrayFilter(values, sql.fragment`posts.id`),
    longPost: (value) => booleanFilter(value, sql.fragment`LENGTH(posts.content) > 500`),
});

// merge filters
const filters = mergeFilters([userFilters, postFilters]);
```

Now, the filters object has all the filters that are declared in the userFilters and postFilters objects. You can use the filters object in the makeQueryLoader function:

```ts
import { mergeFilters } from 'slonik-trpc/utils';

const postsLoader = makeQueryLoader({
    db,
    query: {
        select: sql.type(zodType)`SELECT posts.*, users.first_name, users.last_name`,
        from: sql.fragment`FROM posts LEFT JOIN users ON users.id = posts.author_id`,
    },
    filters,
})
```

To use the filters, pass the where object to the load() function:

```ts
const posts = await postsLoader.load({
  where: {
    OR: [{
      userIds: [1, 2, 3],
    }, {
      longPost: true,
    }]
  }
});
```

This will produce an SQL query like the following:

```sql
SELECT *
FROM posts
LEFT JOIN users ON users.id = posts.user_id
WHERE (users.id = ANY([1,2,3]::text[]) OR LENGTH(posts.content) > 500)
```

:::tip
The mergeFilters function helps with type safety, just like createFilters. They're not necessary if you specify the filters directly as options in the makeQueryLoader options, but that doesn't allow easy reusability.
:::

## Usage with tRPC

It is recommended to disable OR filters, because they can be computationally expensive.
When calling the getLoadArgs function, specify the disabled filters:

```ts
getPosts: publicProcedure
    .input(postsLoader.getLoadArgs({
        disabledFilters: {
            OR: true,
        }
    }))
    .query(({ input, ctx }) => {
        return postsLoader.loadPagination({
            ...input,
            ctx,
        });
    }),
```
