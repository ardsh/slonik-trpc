---
sidebar_position: 11
---

# Virtual fields

Declare any fields you want to process in typescript as virtual fields.

```ts
const virtualFieldsLoader = makeQueryLoader({
    query,
    virtualFields: {
        fullName: {
            dependencies: ["first_name", "last_name"],
            async resolve(row) {
                // async code supported
                return Promise.resolve(row.first_name + row.last_name);
            },
        },
    }
});
```

The virtual fields can then be selected exactly like normal fields. Their return type will be inferred if possible.

```ts
const data = await virtualFieldsLoader.load({
    select: ["id", "fullName"]
}));
```

:::danger
Virtual fields are only supported when using `load`/`loadPagination` currently.
If you're loading results manually using getQuery you won't get the virtual fields.
:::

### Using ctx when resolving

The context is passed as the 2nd argument to each virtual field resolver.
This can be used to return a field based on the context, e.g.

```ts
const virtualFieldsLoader = makeQueryLoader({
    query,
    virtualFields: {
        content: {
            dependencies: ["content"],
            resolve(row, ctx) {
                if (!ctx.isLoggedIn) {
                    // Return null if user isn't logged in.
                    return null;
                }
                return row.content;
            },
        },
    }
});
```

:::tip Overriding
A virtual field can override a real field by using the same name.
:::
