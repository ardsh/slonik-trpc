import { sql } from 'slonik';
import { makeQueryLoader, buildView } from 'slonik-trpc';
import { z } from 'zod';
import { db } from '../db';

const query = sql.type(
    z.object({
        id: z.number(),
        title: z.string(),
        content: z.string().nullish(),
        date: z.string().nullish(),
        first_name: z.string(),
        last_name: z.string(),
        author_id: z.string(),
        email: z.string().nullish(),
        created_at: z.string(),
    })
)`SELECT posts.id,
    posts.title,
    posts.content,
    posts.date,
    author.first_name,
    author.last_name,
    author.email,
    posts.author_id,
    posts.created_at
`;
const view = buildView`FROM posts
LEFT JOIN users author
    ON author.id = posts.author_id`
.addGenericFilter("authorName", (name: string) => name?.length ? sql.fragment`(author.first_name || ' ' || author.last_name) ILIKE ${'%' + name + '%'}` : null)
.addInArrayFilter('author_id', sql.fragment`posts.author_id`)
.addInArrayFilter('id', sql.fragment`posts.id`)
.addDateFilter('date', sql.fragment`posts.created_at`)
.addBooleanFilter('longPost', sql.fragment`LENGTH(posts.content) > 50`)
.addGenericFilter('postLength', (value: number) => sql.fragment`LENGTH(posts.content) > ${value}`)

export const postsLoader = makeQueryLoader({
    query: {
        select: query,
        view,
    },
    db,
    constraints(ctx) {
        if (ctx.user) {
            // Use this to add authorization conditions, limiting which posts can be queried
            return sql.fragment`posts.author_id IS NOT NULL`
        }
    },
    options: {
        orFilterEnabled: true,
    },
    sortableColumns: {
        name: sql.fragment`author.first_name || author.last_name`,
        createdAt: ["posts", "created_at"],
        title: "title",
        date: ["posts", "date"],
    },
    columnGroups: {
        postDetails: ["id", "title", "created_at", "date"],
        author: ["first_name", "last_name", "email", "author_id"],
    },
    virtualFields: {
        fullName: {
            dependencies: ["first_name", "last_name"],
            resolve(row) {
                return `${row.first_name} ${row.last_name}`;
            }
        },
        id: {
            // Virtual fields can overwrite real fields
            dependencies: ["id"],
            resolve(row) {
                return row.id.toString();
            },
        }
    },
});
