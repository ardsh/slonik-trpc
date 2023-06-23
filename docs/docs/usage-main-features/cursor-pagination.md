---
sidebar_position: 15
---

# Cursor-based pagination

To use cursor-based pagination, start by specifying `takeCursors: true` in your options. This will return a `startCursor` and `endCursor` in the pagination response.

Use these cursors in the cursor pagination when you want to go to the next (or previous page).

## Going to next page

Specify

```ts
cursor: endCursor,
take: 25
```

To get the next 25 items after the current page.

## Going to previous page

Specify

```ts
cursor: startCursor,
take: -25
```

This will get the previous page, before the current one.

## Manual searchAfter option

You can also specify the searchAfter option in the pagination arguments. This option takes an object of sortable column values. These values are dependent on the [sortable columns](./sorting.md) option.

For example, if you want to retrieve the next 25 items in the dataset after a specific element, you can do something like this:

This method is not recommended, over using the `cursor` option, since it's a more complicated method of achieving the same thing. Opaque [base-64 encoded cursors are overall much better.](https://slack.engineering/evolving-api-pagination-at-slack/)

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

If you specify a negative number for the `take` option, you'll get the previous page:

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
