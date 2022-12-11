---
title: Motivation
---

# Motivation

Loading tabular data through ORMs is usually either needlessly complex, or very limited.

## The R in ORM

[Any SQL query defines a new Relation](https://theartofpostgresql.com/blog/2019-09-the-r-in-orm/). A relation is a collection of objects that have the same properties.

So an ORM should let you define any SQL queries, to be loaded as arrays of objects, not just base tables that are defined initially in your database.

This tool is not an ORM, it's a small query composer on top of [slonik](https://github.com/gajus/slonik), that uses [zod](https://github.com/colinhacks/zod) to provide type-safety for the outputs as well as the inputs of your data, and so it fits well in a tRPC server.

It doesn't try to hide SQL from you, but it does make it easy to write SQL queries, for a very specific and very common use-case, that is creating APIs for querying tabular data with custom filtering and sorting needs.

Because it doesn't try to build abstractions to replace PostgreSQL, all PostgreSQL features are already available when declaring your relations.

Reusability is as good as your ability to organize queries around into fragments, and then compose them together. Slonik makes this very easy, but you still need to think about which query fragments belong together and which should be separate, then composed together.