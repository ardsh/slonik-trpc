---
sidebar_position: 17
---

# Aggregating

To group your data, you can use the `groupBy` fragment option of the query. This allows you to specify the `GROUP BY` fragment that will be applied to your query:

```ts
const postsLoader = makeQueryLoader({
    db,
    query: {
        select: sql.type(z.object({
            author: z.string(),
            count: z.number(),
        }))`SELECT
            users.first_name || ' ' || users.last_name AS author,
            COUNT(*) AS "postsCount"`,
        from: sql.fragment`FROM posts
        LEFT JOIN users
            ON users.id = posts.author_id`,
        groupBy: sql.fragment`users.id`,
    },
    filters: postsFilter,
});
```

Now this can be used to get the posts count of each user. Additionally, you can reuse all the normal posts filter from the other posts loader.

```ts
// Get post counts of non-gmail users
const groupedByName = await postsLoader.load({
    where: {
        isGmail: false,
    }
}));
```
