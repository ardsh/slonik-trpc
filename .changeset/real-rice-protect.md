---
'slonik-trpc': patch
---

Added virtual field loaders. These are meant to allow efficient loading of data, for multiple rows at once.
Instead of fetching data in the virtual field resolver, one row at a time, you can use a virtual field loader, and then have access to the data in the 3rd argument of the resolver.

```ts
virtualFieldLoaders: {
    posts: async (rows) => {
        const allPosts = await fetchPostsForAuthors(rows.map(row => row.id));
        return allPosts;
    },
},
virtualFields: {
    posts: {
        dependencies: ["id"],
        resolve: (row, args, posts) => {
            return posts.filter(post => post.authorId = row.id)
        }
    }
},
```
