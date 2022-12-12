---
sidebar_position: 8
---

# Authorization

Filters can be used for the authorization logic of the loader. Use the postprocess filter option to add hardcoded conditions to the query, based on the context.

```ts
const filters = createFilters<Context>()({
    ...filters,
}, {
    ...interpreters,
}, {
    postprocess(conditions, filters, ctx) {
        return [
            ...conditions,
            // All conditions are joined with AND
            sql.fragment`users.id=${ctx.userId}`,
        ];
    },
})
```

This results in an additional condition being added to each query.
So the above example query SQL becomes

```sql
WHERE (NOT(email ILIKE '%gmail.com'))
AND (users.id=$1)
```

The postprocessing of filters is executed every time at the end of the interpretation.

:::danger
You should always return the input conditions array, and other extra conditions you want.
Excluding conditions means they won't get applied. However, if you return null or undefined, or forget to return a value, the original conditions will be applied.
:::