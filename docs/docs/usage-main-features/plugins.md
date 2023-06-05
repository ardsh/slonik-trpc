---
sidebar_position: 19
---

# Plugins

You can use plugins to customize the loaders further.

For example, to log any queries that take longer than 500ms use this slow query plugin.

```ts
import { useSlowQueryPlugin } from 'slonik-trpc/utils';

const postsLoader = makeQueryLoader({
    db,
    plugins: [
        useSlowQueryPlugin({
            slowQueryThreshold: 500,
            callback({ query, args, duration }) {
                console.log(`Slow query executed in ${duration}ms`);
                console.log(query.sql, query.values);
            }
        })
    ]
    filters: postsFilter,
});
```

## Building your own plugins

Use the `Plugin` type to build a plugin.

```ts
import type { Plugin } from 'slonik-trpc';

const cachePlugin: Plugin = {
    onLoad(options) {
        const key = getKey(options.args);
        if (cache.hasKey(key)) {
            // You can return a promise
            return options.setResultAndStopExecution(cache.get(key));
        }
    }
}
```
