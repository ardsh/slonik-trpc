import { sql } from 'slonik';
import { makeQueryLoader } from 'slonik-trpc';
import { arrayFilter, dateFilter, booleanFilter, arrayStringFilterType,
    createFilters, dateFilterType, genericFilter } from 'slonik-trpc/utils';
import { z } from 'zod';
import { db } from '../db';
import type { Context } from '../router';

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
FROM posts
LEFT JOIN users author
    ON author.id = posts.author_id`;

const filters = createFilters<Context>()({
    authorName: z.string(),
    id: arrayStringFilterType,
    author_id: arrayStringFilterType,
    date: dateFilterType,
    longPost: z.boolean(),
    postLength: z.number(),
    text: z.string(),
}, {
    authorName: (name) => name?.length ? sql.fragment`(author.first_name || ' ' || author.last_name) ILIKE ${'%' + name + '%'}` : null,
    id: (value) => arrayFilter(value, sql.fragment`posts.id`),
    author_id: (value) => arrayFilter(value, sql.fragment`posts.author_id`),
    date: (value) => dateFilter(value, sql.fragment`posts.created_at`),
    longPost: (value) => booleanFilter(value, sql.fragment`LENGTH(posts.content) > 50`),
    postLength: (value) => genericFilter(value, sql.fragment`LENGTH(posts.content) > ${value}`),
}, {
    postprocess(conditions, filters, context) {
        if (context.user) {
            // Use this to add authorization conditions, limiting which posts can be queried
            conditions.push(sql.fragment`posts.author_id IS NOT NULL`)
        }
        return conditions;
    },
});

export const postsLoader = makeQueryLoader({
    query,
    db,
    filters,
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
