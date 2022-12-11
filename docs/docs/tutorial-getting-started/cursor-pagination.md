---
sidebar_position: 15
---

# Cursor-based pagination

To use cursor-based pagination with the loadPagination function, you can specify the searchAfter option in the pagination arguments. This option takes an object of sortable column values. These values are dependent on the [sortable columns](./sorting.md) option.

For example, if you want to retrieve the next 25 items in the dataset after a specific cursor, you can do something like this:

```ts
const nextPage = await postsLoader.loadPagination({
    orderBy: [["name", "ASC"], ["id", "ASC"]],
    searchAfter: {
        name: "Bob",
        id: 65,
    },
    take: 25,
});
```

Note that for cursor-based pagination to work, the items need to be sorted by a unique, sequential column or combination of columns.

### Paging backwards

If you specify a negative number for the `take` option, you'll be page to get the previous page:

```ts
const previousPage = await postsLoader.loadPagination({
    orderBy: [["name", "DESC"], ["id", "ASC"]],
    searchAfter: {
        name: "Bob",
        id: 65,
    },
    take: -25,
});
```
