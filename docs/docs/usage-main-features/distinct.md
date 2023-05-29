---
sidebar_position: 14
---

# Distinct on

[`DISTINCT ON` is a powerful PostgreSQL feature](https://www.postgresql.org/docs/current/sql-select.html). To use it with your dataloader, you need to specify the sortableColumns option, same as with `orderBy`.

```ts
const postsLoader = makeQueryLoader({
    db,
    query,
    sortableColumns: {
        name: sql.fragment`users.first_name || users.last_name`,
        id: ["posts", "id"],
        date: ["posts", "created_at"],
        title: "title",
    },
});
```

Now you can use these aliases in distinctOn. For example, to get the posts by distinct authors:

```ts
const distinctAuthors = await postsLoader.load({
    distinctOn: ["name"]
    // NOTE: Distinct On automatically adds orderBy fields
    // So you don't have to specify
    // orderBy: ["name", "ASC"],
}));

const sortedByNameAndDate = await postsLoader.load({
    distinctOn: ["name"]
    // NOTE: distinctOn rearranges the orderBy fields, if specified, so the leftmost order is the same
    orderBy: [["date", "ASC"], ["name", "DESC"]],
    // This example would sort by name DESC first, then date, despite the specified orderBy
    take: 5,
}))
```
