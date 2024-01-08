---
"slonik-trpc": patch
---

Added index in virtual field resolve args

BREAKING CHANGE: Removed `virtualFieldLoaders` option.

Also, don't forget to enable `orFilterFilter: true` in `makeQueryLoader` options if you want to keep using the `OR` filters. They're disabled by default now.
