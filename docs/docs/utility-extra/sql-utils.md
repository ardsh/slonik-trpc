---
sidebar_position: 4
---

# PostgreSQL Utils

There are a few generic sql query util functions you can use to make query writing easier.

## Objects and arrays

If you want some fields to be json arrays or objects, use rowToJson and rowsToArray when writing your query

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

rowsToArray takes two SQL fragments, one for selecting the fields, and the other for the FROM part. Behind the scenes, these are joined using the `row_to_json` and `json_agg` postgres functions.

## Filter utils

### Boolean Filter

This filter accepts true/false, and isn't applied for null values.

When the value is `true`, the condition is applied. If it's `false`, the inverse of the condition is applied by default, but that can be specified.

```ts
createFilter<Context>()({
    largsPosts: z.boolean().nullish(),
}, {
    largePosts: (value) => booleanFilter(value, sql.fragment`LEN(posts.text) >= 500`)
});
```

Can be used with

```ts
where: {
    largePosts: false
}
```

This returns only posts with less than 500 characters in text.

### Date Filter

Use the `dateFilterType`, which allows for comparisons with _gt and _lt.

```ts
createFilter<Context>()({
    postsDate: dateFilterType,
}, {
    postsDate: (dateValue) => dateFilter(dateValue, sql.fragment`posts.date`)
});
```

### Multiple string filter

Use the `arrayStringFilterType`.

```ts
createFilter<Context>()({
    ids: arrayStringFilterType,
}, {
    ids: (values) => arrayFilter(values, sql.fragment`users.id`)
});
```

### Comparison filter

The general comparison filter allows filtering a field with many options.

```ts
createFilter<Context>()({
    postTitle: comparisonFilterType,
}, {
    postTitle: (values) => comparisonFilter(values, sql.fragment`posts.title`)
});
```

This allows using `_eq`, `_gt`, `_lt`, `_in` and `_nin` for filtering, as well as `_is_null`.

E.g.
```ts
where: {
    postTitle: {
        _in: ["A", "B", "C"],
        _is_null: false,
    }
}
```

Use the stringFilter for an even more comprehensive list of options, similar to [hasura's text filters](https://hasura.io/docs/latest/api-reference/graphql-api/query/#text-operators)
