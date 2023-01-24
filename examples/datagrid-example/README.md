# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## Getting started

This is an example using SQLite+prisma for codesandbox compatibility. slonik-trpc supports a `sqlite` compatibility mode, and it can work with other clients besides slonik, because all it does is generate SQL queries from the fragments you supply.

In a real-life project you'd probably wanna use PostgreSQL. [This is a good article for free PostgreSQL databases in the cloud](https://hasura.io/blog/top-postgresql-database-free-tier-solutions/). Once you have a DATABASE_URL you can use it with slonik.

To get started run:

```bash
yarn prisma db push
yarn dev
```
