---
sidebar_position: 9
---

# Query loader performance analyzer

Use the `makeQueryAnalyzer` function for analyzing the performance of your fields, as well as testing all query filters.

```ts
import { makeQueryAnalyzer } = 

const analyzer = makeQueryAnalyzer(db)
const result = await analyzer.benchmarkQueryLoaderFields(loader, {
    iterations: 10,
    args: {
        take: 200,
        where: {
            id: 42,
        }
    }
});

result['id']// number in milliseconds of the time it takes DB to resolve the id field 10 times.
result['posts'] // same number, for the posts field
```

This will allow you to compare different fields, which is useful especially if some of them use complex sub-queries, to detect inefficiencies.

## Test filters

Use the `testAllFilters` for a query that will try to execute all the filters at once. This is a good way to check for SQL syntax errors in your filters or queries, as this will usually detect them.

```ts
test("All filters work", async () => {
    const result = await makeQueryAnalyzer(db).testAllFilters(loader);
    expect(result).toBeDefined();
});
```
