# slonik-trpc

## 0.14.0

### Minor Changes

-   2770420: Breaking change: Changed virtual fields resolver 2nd argument to take full args instead of just context

## 0.13.7

### Patch Changes

-   0c86154: Increased test coverage

## 0.13.6

### Patch Changes

-   7b1cb0d: Minor bugfixes

## 0.13.5

### Patch Changes

-   cb48c1a: Fixed benchmark types

## 0.13.4

### Patch Changes

-   6649ad7: Added benchmarking of fields

## 0.13.3

### Patch Changes

-   0074ae3: Added runConcurrency option

## 0.13.2

### Patch Changes

-   bff0e7f: Added contextFactory and count overwriting in plugins

## 0.13.0

### Minor Changes

-   6984f94: Added plugins

## 0.12.0

### Minor Changes

-   8518113: Added DISTINCT ON support

## 0.11.0

### Minor Changes

-   8402cef: BREAKING CHANGE:
    `getQuery` is now asynchronous.

    Filter interpreters can be asynchronous.

## 0.10.1

### Patch Changes

-   1fd49a8: Fixed nullable columns cursor pagination

## 0.10.0

### Minor Changes

-   ef0393f: ## Breaking Changes

    -   Removed old query fragment option.
    -   Specify query as an object with `select`, `from`, and `groupBy` keys.

## 0.9.2

### Patch Changes

-   0ca01d2: Added groupBy option for query, deprecated old method of declaring queries

## 0.9.1

### Patch Changes

-   19cbf89: Added constraints option for authorization

## 0.9.0

### Minor Changes

-   636d400: BREAKING CHANGE: Renamed `edges` to `nodes` in `loadPagination` result

## 0.8.3

### Patch Changes

-   73b74e2: Added zod any support, and sqlite experimental support

## 0.8.2

### Patch Changes

-   c66a58d: Added runtime checking of result rows

## 0.8.1

### Patch Changes

-   6e5a2da: Changed cursors to encode json objects instead of arrays

## 0.8.0

### Minor Changes

-   5a28e4f: BREAKING CHANGES in loadPagination:

    -   Added `pageInfo` object, moved all pageInfo related keys in pageInfo.
    -   Added cursors array, when takeCursors is specified.

## 0.7.2

### Patch Changes

-   b3ac708: Added limit to pagination take API

## 0.7.1

### Patch Changes

-   084d970: Fixed cursor pagination query

## 0.7.0

### Minor Changes

-   8d0a58f: Added base64 opaque cursors

## 0.6.4

### Patch Changes

-   d8e05a6: Improved type inference

## 0.6.3

### Patch Changes

-   289dc27: - Added option to disable recursive filters in public API
    -   Added default orderBy
    -   Added debugging SQL queries with DEBUG=slonik-trpc

## 0.6.1

### Patch Changes

-   f9c9fec: Added context parameter to virtual field resolvers

## 0.6.0

### Minor Changes

-   7675fa8: Removed postprocessing option

## 0.5.0

### Minor Changes

-   3ef653f: Removed exclude and require options

## 0.4.0

### Minor Changes

-   bb218ec: Added column groups

## 0.3.3

### Patch Changes

-   b1736ab: - Improved performance of virtual fields

    -   Added searchAfter in loadArgs

## 0.3.2

### Patch Changes

-   f412249: Added cursor-based pagination

## 0.3.0

### Minor Changes

-   991910c: Improved sorting API

## 0.2.4

### Patch Changes

-   9798512: Added support for sorting by multiple columns.

## 0.2.2

### Patch Changes

-   ccf3bce: Added async promises to virtual fields

## 0.2.0

### Minor Changes

-   b81776b: Added default excluded columns
    Added merge filters utility
    Added slonik-trpc/utils import
    Added type checking interceptor

## 0.1.2

### Patch Changes

-   0d2de08: Added createFilter helper method
    Added helper methods for creating filters
