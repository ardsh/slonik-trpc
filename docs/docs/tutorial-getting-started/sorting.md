---
sidebar_position: 13
---

# Sorting

To add sorting to your data, you can use the sortableColumns option. This allows you to specify the columns that can be sorted, along with their corresponding sorting expressions. For example:

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

Now you can use these aliases in the orderBy. For example, to sort the posts by name and date:

```ts
const sortedByName = await postsLoader.load({
    orderBy: ["name", "ASC"],
}));

const sortedByNameAndDate = await postsLoader.load({
    orderBy: [["name", "DESC"], ["date", "ASC"]],
    take: 5,
}))
```

### Transforming sorting

You can use the `transformSortColumns` function in the `getLoadArgs()` call to transform the orderBy array.

For example, to add a tie-breaker column to the sorting, you can use the following code:

```ts title="postsRouter.ts"
getPosts: publicProcedure
    .input(postsLoader.getLoadArgs({
        transformSortColumns(columns) {
            // Adds id ASC at the end as a tie-breaker
            return [...columns, ["id", "ASC"]];
        }
    }))
    .query(({ input, ctx }) => {
        return postsLoader.loadPagination({
            ...input,
            // Complete overwriting is also possible...
            orderBy: input.orderBy || ["id", "ASC"],
            ctx,
        });
    }),
```

This will add the id column in ascending order as a tie-breaker to the sorting, ensuring that the results are always sorted consistently.

Sortable columns are necessary for [cursor-based pagination](./cursor-pagination.md) to work.

If you do not specify any sortableColumns, your API will not be sortable with orderBy. Only columns that are specified in sortableColumns are allowed to be used in orderBy.
