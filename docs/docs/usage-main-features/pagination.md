---
sidebar_position: 5
---

# Offset-based pagination

Offset-based pagination allows you to specify the number of items to take and skip when requesting a page of results. This can be useful when working with large datasets and you only need a portion of the data at a time.

To use offset-based pagination, you can specify the take and skip options when calling the loadPagination method:

```ts
const posts = await postsLoader.loadPagination({
    take: 50,
    skip: 75,
});
```

This will return an object with the following shape:

```json
{
    "edges": [{
        // ...posts array with 50 items.
    }],
    "hasNextPage": true,
    // Letting you know there's an extra page, because at least 76 items were loaded (75 skipped + 50 take + 1)
    "minimumCount": 126,
    "count": null,
}
```

## Retrieving count

If you need to know the total number of items in the result set, as if no take or skip options were applied, you can specify the `takeCount: true` option. By default, this option is set to false to avoid costly count queries.

```ts
const posts = await postsLoader.loadPagination({
    take: 25,
    skip: 50,
    takeCount: true,
});
```

This may return an object with the following shape:

```json
{
    "edges": [{
        // ...posts array with 25 items.
    }],
    "hasNextPage": true,
    // Letting you know there's an extra page, because at least 76 items were loaded (50 skipped + 25 take + 1)
    "minimumCount": 76,
    "count": 443,
}
```

:::danger Avoid
It is recommended to avoid using takeCount: true if possible, for performance reasons. Instead, you can use the minimumCount or hasNextPage properties to determine whether there is a next page.
:::
