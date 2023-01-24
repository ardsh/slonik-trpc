---
sidebar_position: 8
---

# Authorization

The constraints option can be used for the authorization logic of the loader.
Use it to add hardcoded conditions to the query, based on the context.

```ts

const userLoader = makeQueryLoader({
    db,
    query,
    filters,
    constraints(ctx) {
        if (ctx.role === 'ADMIN') {
            // Allow admins to query anyone by returning no extra permission rules.
            return null;
        } else {
            // Only allow querying the users in the same org as the logged in user
            return sql.fragment`users.org_id=${ctx.orgId}`;
        }
    }
});
```

This results in an additional condition being added to each query, if the ctx.role is not `ADMIN`. If it is an admin, no extra constraints are added.

So when a user tries to filter gmail users only, the query SQL would be:

```sql
WHERE (NOT(email ILIKE '%gmail.com'))
AND (users.org_id=$1)
```

And they wouldn't be able to see any users outside their organization.
