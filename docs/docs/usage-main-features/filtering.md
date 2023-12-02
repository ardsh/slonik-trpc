---
sidebar_position: 7
---

# Filtering

When building views, you have the possibility to declare filters.

The `buildView` function includes several easy-to-add filter types.


## Contained in array filter

```ts
const userView = buildView`FROM users`
    .addInArrayFilter('id', () => sql.fragment`users.view`, 'numeric')
```

This is a simple way to add a filter that accepts both an array, and a single value, of a specific field. The 2nd argument specifies the column we want to compare against (and it can be any kind of SQL fragment, e.g. a `COALESCE` function call, not just a single column).

The above allows you to filter with the `where` API like below:

```ts
where: {
    OR: [{
        id: [3, 4, 5]
    }, {
        NOT: {
            id: 6
        }
    }]
}
```

`OR`, `AND`, and `NOT` filters are added automatically, but they can be removed.


This will produce an SQL condition like the following:

```sql
WHERE users.id = ANY([3,4,5]::numeric[])
OR (
  NOT(
    users.id = ANY([6]::numeric[])
  )
)
```

## String comparisons filter

If you don't need to specify complex columns with SQL fragments, you can use the `tableName.column` to more easily create multiple filters. For string comparisons specifically, you'll be able to use filters like `_ilike`, `_iregex` etc.

```ts
userView.addStringFilter(['users.name', 'users.profession'])
```

This allows both the `name` and `profession` columns to be filterable with string operators.
```ts
where: {
    "users.name": {
        _ilike: 'John',
    },
    "users.profession": {
        _iregex: 'programmer',
    },
}
```

### Comparison filters

```ts
userView.addComparisonFilter('postsCount', () => sql.fragment`(
    SELECT COUNT(*) FROM posts
    WHERE posts.author_id = users.id
)`)
```

This allows you to filter by the number of posts a user has. The above will allow you to filter with the `where` API like below:

```ts
where: {
    postsCount: {
        _gte: 5,
    },
}
```

In actuality you'll want to avoid complex SQL fragments like the above, for performance reasons, and instead use a view that already has the `postsCount` column, but this is just an example.

### Boolean filters

The `addBooleanFilter` utility takes in a fragment and applies it if the input is true. It applies the inverse of the condition if the input is `false`, and doesn't apply the filter at all if the input is `null`/`undefined`.

```ts
userView.addBooleanFilter('isGmail', () => sql.fragment`users.email ILIKE '%gmail.com'`)
```

To use the filter, you can pass an `isGmail` value to the `where` object:

```ts
where: {
    isGmail: false,
}
```

This will return only users that don't have their email ending in gmail.com, because we specified `false`.

The equivalent SQL would be

```sql
WHERE NOT(email ILIKE '%gmail.com')
```

### JSON filters

The `addJsonContainsFilter` utility is designed to filter records based on the contents of a JSONB column in your database. It uses [PostgreSQL's `@>` operator](https://www.postgresql.org/docs/current/functions-json.html#FUNCTIONS-JSON-PROCESSING) to check if the JSONB column contains a specific structure or value.

```ts
// Adding the JSON contains filter
view.addJsonContainsFilter('settings');
```

In this example, `addJsonContainsFilter` is set up to filter based on the 'settings' JSONB column.

To use this filter, you can pass a corresponding object to the where clause:

```ts
// Example: Filtering for users with specific settings
where: {
    settings: {
        notifications: true,
        theme: 'dark'
    }
}
```

This query filters for users whose 'settings' JSONB column contains both the `notifications: true` and `theme: 'dark'` key-value pairs. The equivalent SQL would be:

```sql
WHERE "settings"::jsonb @> '{"notifications": true, "theme": "dark"}'
```

:::tip
- The addJsonContainsFilter is particularly efficient for straightforward checks of presence or absence of certain keys/values in a JSONB column.
- This method is ideal for scenarios where you need to filter records based on a set of JSONB criteria without the need for more complex JSONB querying capabilities.
:::

Similarly to other filters, you can specify a 2nd "mapper" argument to specify a different field from the filter name, e.g.

```ts
view.addJsonContainsFilter('settings', () => sql.fragment`users.user_settings`);
```

## Generic filters

If you need more flexibility, you can use `addGenericFilter`

```ts
const userView = buildView`FROM users`
    .addGenericFilter('ID', (value: string) => sql.fragment`users.id = ${value}`)
```

This allows you to filter with the `where` API like below:

```ts
where: {
    ID: '123',
}
```

You can also declare more limited versions of the above filters, via `addGenericFilter`:

```ts
const userView = buildView`FROM users`
    .addGenericFilter('name_contains', (value: string) => sql.fragment`users.name ILIKE ${'%' + value + '%'}`)
    .addGenericFilter('postsCount_gt', (value: number) => sql.fragment`(
        SELECT COUNT(*) FROM posts
        WHERE posts.author_id = users.id
    ) > ${value}`)
```

:::tip
The 2nd argument is an interpret function that accepts the value of that specific filter, the values of all the filters (`where` paramter), and the context (`ctx` parameter).
It should return a SQL fragment.
:::

If you want you can create your own helpers, for reusability:

```ts

const containsFilter = (name: SqlIdentifierToken) => (value: string) => sql.fragment`${name} ILIKE ${'%' + value + '%'}`

const userView = buildView`FROM users`
    .addGenericFilter('name_contains', containsFilter(sql.identifier`users.name`))
    .addGenericFilter('profession_contains', containsFilter(sql.identifier`users.profession`))
```

## Merging filters

A good method of organizing filters is to declare them with basic views, for each table, and then reuse them as necessary for more complex views.

```ts
const postView = buildView`FROM posts`
    .addStringFilter(['posts.title', 'posts.content'])
    .addBooleanFilter('longPost', () => sql.fragment`LENGTH(posts.content) > 500`)
const userView = buildView`FROM users`
    .addStringFilter(['users.first_name', 'users.last_name'])
    .addBooleanFilter('isGmail', () => sql.fragment`users.email ILIKE '%gmail.com'`)
```

If we have a view that joins the `posts` and `users` tables, we can reuse the filters from the `postView` and `userView`:

```ts
const combinedView = buildView`FROM posts
    LEFT JOIN users ON users.id = posts.author_id`
    .addFilters(postView.getFilters({
      table: 'posts'
    }))
    .addFilters(userView.getFilters({
      table: 'users'
    }))
```

Now you'll be able to filter by `posts.title`, `posts.content`, `posts.longPost`, `users.first_name`, `users.last_name`, and `users.isGmail` in the combined view.

```ts
where: {
    OR: [{
        "posts.title": {
            _ilike: 'John%',
        },
    }, {
        "users.isGmail": false,
    }]
}
```

Note that `isGmail` is automatically prefixed with `users`, and `longPost` with `posts`.

This will produce an SQL query like the following:

```sql
SELECT *
FROM posts
LEFT JOIN users ON users.id = posts.author_id
WHERE ("posts"."title" ILIKE 'John%' OR NOT(users.email ILIKE '%gmail.com'))
```

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
