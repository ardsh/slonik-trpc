---
sidebar_position: 6
---

# Usage with tRPC

Add a query that uses getLoadArgs and loadPagination from the postsLoader to return data

```ts title="postsRouter.ts"
getPosts: publicProcedure
    .input(postsLoader.getLoadArgs())
    .query(({ input, ctx }) => {
        return postsLoader.loadPagination({
            ...input,
            ctx,
        });
    }),
```

Now the API is accessible from your tRPC query. The getLoadArgs returns a zod type that will allow you to restrict user input further than what the makeQueryLoader API allows.

```ts
const posts = await client.getPosts.query({
    select: ["id", "title", "content"], // Will query only these 3 columns.
    take: 25,
    skip: 0,
});
```
