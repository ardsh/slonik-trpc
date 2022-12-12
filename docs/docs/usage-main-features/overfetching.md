---
sidebar_position: 9
---

# Overfetching

Selecting groups of fields in a query can help you organize your data more effectively and avoid overfetching.

Selecting fields and groups of fields is fully type-safe. This means you'll get autocomplete functionality only on the fields you select.


### Selecting single columns

You can use the select option, to specify the fields you need, and only those will be queried.

```ts
const data = await postsLoader.load({
    select: ["id", "name"]
}));
```

### Grouping columns

By organizing your fields into logical groups, you can make it easier to understand the structure of your data and quickly identify which fields you need to query.

To group fields in a makeQueryLoader call, pass an object with the group names to the columnGroups option. Then, pass the group names you'd like to select in the selectGroups option when loading items.

For example, given the following makeQueryLoader call:

```ts
const postsLoader = makeQueryLoader({
    columnGroups: {
        basic: ["id", "name"],
        author: ["first_name", "last_name"],
        extraPostFields: ["created_at", "content"],
    },
    query: sql.type(zodType)`SELECT posts.*, users.first_name, users.last_name FROM posts LEFT JOIN users ON users.id = posts.author_id`,
});
```

You can load only basic fields and author fields, e.g. during a pagination call that only needs the title and author names.

```ts
const data = await postsLoader.loadPagination({
    selectGroups: ["basic", "author"], // Returns id, name, first_name, and last_name
});
```

Then load more data in a post-specific query

```ts
const detailedPostData = await postsLoader.load({
    take: 1,
    where: {
        postIds: 3,
    },
    selectGroups: ["basic", "author", "extraPostFields"], // Returns id, name, first_name, and last_name, created_at and content
});
```

:::tip Benefits of selections
Avoiding overfetching can help you save resources on your database server. By querying only the data you need, you can reduce the amount of memory and processing power required to execute your queries. This can help your database server run more efficiently and handle more concurrent requests.
:::
