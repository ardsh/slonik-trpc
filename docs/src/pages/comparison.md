# Comparisons with ORMs

## Prisma Client

If you're using prisma client, and it is sufficient for your querying needs, you shouldn't need to use this tool.

Prisma has limited, unofficial support for [SQL views](https://github.com/prisma/prisma/issues/678). If the basic prisma models aren't sufficient for your queries, but you're content with using prisma SQL views, you also shouldn't need to use this tool.

If you're frustrated with the inability to declare custom filters in SQL, or you find yourself making queries with deep-nested relations that are inherently less efficient in prisma (because of the dataloader pattern it uses for nested relations), you *might* want to consider using this tool and seeing the performance benefits that could come with simpler, custom-built queries.

If you find yourself using prisma's [rawQuery database access](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access) to query tabular data, you *probably* would benefit from using this tool.

This tool has virtual field support.

## Inflexibility of Hasura

Hasura takes a different approach to solving the SQL query problem.
Hasura is not an ORM, it's just a GraphQL engine, that converts your GraphQL queries into SQL queries.
In many ways this tool is inspired by hasura, but on a **much** smaller scale.
Hasura allows you to define custom views as relations

If you've used hasura before, but would like even more control and flexibility over your data loading, this tool is probably a good fit.
