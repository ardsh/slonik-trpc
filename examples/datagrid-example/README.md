# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## Getting started

You need a PostgreSQL database, simply export `DATABASE_URL`

[This is a good article for free PostgreSQL databases in the cloud](https://hasura.io/blog/top-postgresql-database-free-tier-solutions/). Once you have a DATABASE_URL you can use it with slonik.

Then run

```bash
yarn prisma db push
yarn dev
```
