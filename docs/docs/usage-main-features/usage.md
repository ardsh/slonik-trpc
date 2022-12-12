---
sidebar_position: 4
---

# Usage

`slonik-trpc` allows you to create a loader for each SQL query. With this loader, you can filter, sort, and paginate your data with ease, all while leveraging the power and efficiency of SQL. 

You can look at the [minimal-example playground](https://stackblitz.com/github/ardsh/slonik-trpc/tree/main/examples/minimal-trpc) for a simple query loader, or [other examples](https://stackblitz.com/github/ardsh/slonik-trpc/tree/main/examples/datagrid-example).

## Create a query loader

Create a file at `src/postsLoader.ts`:

```ts title="postsLoader.ts"
import { makeQueryLoader } from 'slonik-trpc';
import { sql } from 'slonik';

const postsQuery = sql.type(z.object({
        id: z.number(),
        author: z.string(),
        title: z.string(),
        date: z.string(),
    }))`SELECT
        posts.id,
        users.first_name || ' ' || users.last_name AS author,
        posts.title,
        posts.date
    FROM posts
    LEFT JOIN users
        ON users.id = posts.author_id`;

export const postsLoader = makeQueryLoader({
    db,
    query,
});
```
