import { z } from 'zod';
import { createMockPool, createMockQueryResult, sql } from 'slonik';
// import { makeQueryLoader, createOptions } from '../../../lib/index';
import { makeQueryLoader, createOptions } from '../../index';
import { rowToJson } from '../../utils';

const query = sql.type(z.object({
    id: z.number(),
    uid: z.string(),
    value: z.string(),
    date: z.number(),
    user: z.object({
        first_name: z.string(),
        last_name: z.string(),
        email: z.string(),
    }),
}))`SELECT test_table_bar.id, uid, value, date
, ${rowToJson(
    sql.fragment`
    SELECT first_name, last_name, email
    WHERE users.id IS NOT NULL`, 'user'
)}
`;
const fromFragment = sql.fragment`FROM test_table_bar
LEFT JOIN users
ON users.id = test_table_bar.uid`;

const items = new Array(10000).fill(0).map((a, i) => ({
    id: i,
    uid: i.toString(),
    value: Math.random().toString(),
    date: Math.random(),
    user: {
        first_name: 'Bob',
        last_name: 'Robert',
        email: 'bob@robert.com',
    },
}))

const options = createOptions({
    db: createMockPool({
        query: async () => createMockQueryResult(items as any),
    }),
    query: {
        select: query,
        from: fromFragment,
    },
});

export const testLoader = async (opts?: { name?: string } & Omit<Parameters<typeof makeQueryLoader>[0], "query" | "db">) => {
    const loader = makeQueryLoader(opts ? {
        ...opts,
        ...options,
    } as never : options);
    console.time(opts?.name || 'defaultCase');
    await loader.load({
        take: 10000,
    })
    console.timeEnd(opts?.name || 'defaultCase');
    return loader;
};

async function benchmark() {
    const loader = await testLoader();
    const withVirtualFields = await testLoader({
        name: 'virtualFields',
        virtualFields: {
            blabla: {
                dependencies: ["date"],
                resolve(row) {
                    return row.date;
                }
            },
            anotherOne: {
                dependencies: ["id"],
                resolve(row) {
                    return row.id;
                }
            },
            thirdOne: {
                dependencies: ["uid"],
                resolve(row) {
                    return row.uid;
                }
            }
        }
    });
    const virtualFieldsPromises = await testLoader({
        name: 'virtualFieldsPromises',
        virtualFields: {
            blabla: {
                dependencies: ["date"],
                async resolve(row) {
                    return row.date;
                }
            },
            anotherOne: {
                dependencies: ["id"],
                async resolve(row) {
                    return row.id;
                }
            },
            thirdOne: {
                dependencies: ["uid"],
                async resolve(row) {
                    return row.uid;
                }
            },
            fourth: {
                dependencies: ["value"],
                async resolve(row) {
                    return row.value;
                }
            },
            fifth: {
                dependencies: ["user"],
                async resolve(row) {
                    return row.user;
                }
            }
        }
    });
    const realisticVirtualFields = await testLoader({
        name: 'mixedVirtualFields',
        virtualFields: {
            blabla: {
                dependencies: ["date"],
                async resolve(row) {
                    return new Promise(res => setTimeout(res, 10));
                }
            },
            anotherOne: {
                dependencies: ["id"],
                resolve(row) {
                    return row.id;
                }
            },
            thirdOne: {
                dependencies: ["uid"],
                resolve(row) {
                    return row.uid;
                }
            },
            fourth: {
                dependencies: ["value"],
                async resolve(row) {
                    return new Promise(res => setTimeout(res, 15));
                }
            },
            fifth: {
                dependencies: ["user"],
                async resolve(row) {
                    return new Promise(res => setTimeout(res, 25));
                }
            }
        }
    });
}

if (require.main === module) {
    benchmark().catch(console.error)
} 
