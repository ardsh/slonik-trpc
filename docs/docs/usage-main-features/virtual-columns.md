---
sidebar_position: 11
---

# Virtual fields

Declare any fields you want to process in typescript as virtual fields.

```ts
const virtualFieldsLoader = makeQueryLoader({
    // ...
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

The query arguments are passed as the 2nd argument to each virtual field resolver.
This can be used to return a field based on the context, e.g.

```ts
const virtualFieldsLoader = makeQueryLoader({
    // ...
    virtualFields: {
        content: {
            dependencies: ["content"],
            resolve(row, args) {
                if (!args.ctx.isLoggedIn) {
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
A virtual field can override a real field by using the same name. This can also be used to access control certain fields based on user context.
:::

### Remote joins

If you need to load remote data in your virtual fields, it's often more efficient to use a batch loader, rather than returning a promise in the resolve function of each row. Use `load` for this purpose.

#### ❌ **⚠️ Avoid This!**

```ts
virtualFields: {
    posts: {
        dependencies: ["id"],
        // 📉 This can lead to performance issues.
        resolve: async (row) => {
            const posts = await fetchPostsForAuthor(row.id);
            return posts;
        }
    }
},
```

#### ✅ Do This Instead!

```ts
virtualFields: {
    posts: {
        dependencies: ["id"],
        // 🚀 Use the load function to fetch data in batches
        async load(rows) {
            const allPosts = await fetchPostsForAuthors(rows.map(row => row.id));
            return allPosts;
        },
        // ✔️ Use the resolve function to handle synchronous operations.
        resolve: (row, args, posts) => {
            // Only return the posts of each user.
            return posts.filter(post => post.authorId = row.id)
        }
    }
},
```
