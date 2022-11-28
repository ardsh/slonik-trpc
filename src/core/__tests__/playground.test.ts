// prettier-ignore
import { sql } from 'slonik';
import { z } from 'zod';
import { expectTypeOf } from 'expect-type';
import { makeQueryTester } from './makeQueryTester';
import { makeQueryLoader } from '../makeQueryLoader';

import { createFilters, arrayStringFilterType, arrayFilter, booleanFilter, dateFilterType, dateFilter } from '../../utils';

const db = makeQueryTester('playground').db;

test("playground", async () => {
expect(3).toEqual(3);

const query = sql.type(z.object({
    id: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.string(),
    created_at: z.number(),
}))`SELECT id, first_name, last_name, email, created_at FROM users`;

const selectionLoader = makeQueryLoader({
    query,
});

const selectedOnly = await db.any(selectionLoader.getQuery({
    select: ["id", "first_name"],
}));

// Only id and name are available in type now
expectTypeOf(selectedOnly[0]).toEqualTypeOf<{ id: string, first_name: string }>();

const excludedOnly = await db.any(selectionLoader.getQuery({
    exclude: ["id", "first_name", "last_name"],
}));

// id and name are excluded
expectTypeOf(excludedOnly[0]).toEqualTypeOf<{ email: string, created_at: number }>();


const sortableLoader = makeQueryLoader({
    query,
    sortableColumns: {
        first_name: "first_name",
        created_at: "created_at",
    },
});


const sortedByName = await db.any(sortableLoader.getQuery({
    orderBy: ["first_name", "ASC"],
}));

// All fields are included if select/exclude aren't specified
expectTypeOf(sortedByName[0]).toEqualTypeOf<{ id: string, first_name: string, last_name: string, email: string, created_at: number }>();

const virtualFieldsLoader = makeQueryLoader({
    query,
    db,
    virtualFields: {
        fullName: {
            dependencies: ["first_name", "last_name"],
            async resolve(row) {
                // async code supported
                return Promise.resolve(row.first_name + row.last_name);
            },
        },
        age: {
            dependencies: ["created_at"],
            resolve({ created_at }) {
                return (Date.now() - created_at) / 1000;
            }
        }
    }
});

// the Load function must be used for virtual fields/transformations
const virtualFieldData = await virtualFieldsLoader.load({
    // Dependent fields are automatically selected
    select: ["fullName"],
});

// Full type safety for virtual fields
expectTypeOf(virtualFieldData[0]).toEqualTypeOf<{ fullName: string }>();


const allFieldsData = await virtualFieldsLoader.load({
    select: ["age", "fullName"],
});

expectTypeOf(allFieldsData[0]).toEqualTypeOf<{ age: number, fullName: string }>();

// Filter declaration

const testContext = z.object({
    userId: z.string(),
})
type TestContext = z.infer<typeof testContext>;

const filters = createFilters<TestContext>()({
    // Specify the filter input types with zod types
    name: z.string(),
    id: arrayStringFilterType,
    createdDate: dateFilterType,
    isGmail: z.boolean(),
    // Then the interpreter functions for each filter
}, {
    // If isGmail: true, return emails that end in gmail.com
    isGmail: (value) => booleanFilter(value, sql.fragment`email ILIKE '%gmail.com'`),
    // If a non-sql fragment is returned, no condition is applied.
    name: (value) => value?.length > 2 && sql.fragment`name=${value}`,
    // util function allows you to use a string or array of strings as input
    // Returns only ids in the array, if any elements are specified.
    id: (value) => arrayFilter(value, sql.fragment`users.id`),
    createdDate: (value) => dateFilter(value, sql.fragment`users.created_at`),
}, {
    postprocess(conditions, filters, ctx) {
        // Using postprocessing of filters for adding authorization checks
        if (ctx?.userId) {
            conditions.push(sql.fragment`users.id=${ctx.userId}`);
        }
        // All conditions are joined with AND
        return conditions;
    },
});

const filtersLoader = makeQueryLoader({
    query,
    db,
    filters,
    contextParser: testContext,
});

const gmailUsers = await filtersLoader.load({
    where: {
        isGmail: true,
    }
});

const specificUsers = await filtersLoader.load({
    where: {
        // created between yesterday and now
        createdDate: {
            _lt: new Date().toISOString(),
            _gt: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
        },
        OR: [{
            // Returns users with these specific ids
            id: ['x', 'y', 'z'],
        }, {
            // or non-gmail users.
            isGmail: false,
        }]
    }
});
console.log('Gmail users: %O', gmailUsers);
console.log('Specific users: %O', specificUsers);

console.log(gmailUsers[0].email);

});
