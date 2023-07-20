import { makeQueryLoader, InferPayload, InferArgs } from '../makeQueryLoader';
import { sql } from 'slonik';
import { z } from 'zod';
import { makeQueryTester } from './makeQueryTester';

import { createFilters, makeFilter } from '../queryFilter';
import { createGroupSelector } from '../selectGroups';
import { arrayFilter, booleanFilter, dateFilter, dateFilterType, arrayifyType } from '../../helpers/sqlUtils';
import { expectTypeOf } from 'expect-type';
import { createOptions } from '../../index';
import { useSlowQueryPlugin } from '../plugins';

const decodeCursors = ({ startCursor='', endCursor='' }) => {
    return {
        start: JSON.parse(Buffer.from(startCursor, 'base64').toString()),
        end: JSON.parse(Buffer.from(endCursor, 'base64').toString()),
    }
}

describe("withQueryLoader", () => {
    const { db } = makeQueryTester();

    it("works with querying", async () => {
        const result = await db.any(sql.unsafe`SELECT 3 as number;`);
        expect(result).toEqual([{
            number: 3
        }]);
    });

    const zodType = z.object({
        id: z.number(),
        uid: z.string(),
        value: z.string()
    });

    it("Works with fragment", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            type: z.object({
                id: z.number(),
                uid: z.string(),
                value: z.string(),
            }),
        });
        const result = await loader.load({});
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result).not.toHaveLength(0);
        expectTypeOf(result[0]).toEqualTypeOf<{ id: number, uid: string, value: string }>();
    });

    it("Throws errors for invalid queries", async () => {
        expect(() => makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`test_table_bar`,
            },
        })).toThrow("query.from must begin with FROM");

        expect(() => makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`id, uid, value`,
                from: sql.fragment`FROM test_table_bar`,
            },
        })).toThrow("Your query must begin with SELECT");
    });

    it("Works with sql query type", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
        });
        const result = await loader.load({});
        expect(result[0].id).toEqual(expect.any(Number));
        expectTypeOf(result[0]).toEqualTypeOf<{ id: number, uid: string, value: string }>();
        expect(result).not.toHaveLength(0);
    });

    it("Returns correct query", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
        });
        const query = await loader.getQuery({
            select: ['id'],
        });

        expect(query.sql).toMatch("id");
        expect(query.sql).not.toMatch("value");
        expect(query.parser._def.toString()).toEqual(zodType._def.toString());
    });

    it("Returns virtual fields", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            virtualFields: {
                ids: {
                    resolve: (row) => {
                        return row.id + row.uid;
                    },
                    dependencies: ["id", "uid"],
                }
            }
        });
        const query = await loader.load({
            select: ['value', 'ids'],
            take: 1
        });
        expect(query[0]?.ids).toEqual(expect.any(String));
        expect(loader.getSelectableFields()).toContain("ids");
        expectTypeOf(loader.getSelectableFields()[0]).toEqualTypeOf<"ids" | "id" | "uid" | "value">();
    });

    it("Returns virtual fields by default if none are selected/excluded", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            virtualFields: {
                ids: {
                    resolve: (row, ctx) => {
                        expect(ctx).toEqual({
                            userId: 'r',
                        });
                        return row.id + row.uid + ctx.userId;
                    },
                    dependencies: ["id", "uid"],
                }
            }
        });
        const query = await loader.load({
            take: 1,
            ctx: {
                userId: 'r',
            }
        });
        const row = query[0];
        expect(row?.ids).toEqual(row.id + row.uid + 'r');
        expect(loader.getSelectableFields()).toContain("ids");
        expectTypeOf(query[0]).toEqualTypeOf<{ id: number, ids: string, uid: string, value: string }>()
    });

    it("A virtual field can overwrite a real field", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            virtualFields: {
                id: {
                    resolve: (row) => {
                        return row.id.toString();
                    },
                    dependencies: ["id"],
                }
            }
        });
        const query = await loader.load({
            take: 1
        });
        expect(query[0]?.id).toEqual(expect.any(String));
        expect(loader.getSelectableFields()).toContain("id");
        expectTypeOf(query[0]).toEqualTypeOf<{ id: string, uid: string, value: string }>()
    });

    it("Doesn't return virtual fields by default if some others are selected", async () => {
        const resolve = jest.fn((row) => row.id + row.uid);
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            virtualFields: {
                ids: {
                    resolve,
                    dependencies: ["id", "uid"],
                }
            }
        });
        const query = await loader.load({
            take: 1,
            select: ["id", "uid"]
        });
        // @ts-expect-error ids is not selected
        expect(query[0]?.ids).toBeUndefined();
        expectTypeOf(query[0]).toEqualTypeOf<{ id: number, uid: string }>();
        expect(loader.getSelectableFields()).toContain("ids");
        expect(resolve).not.toHaveBeenCalled();
    });

    it("Passes the context as a 2nd parameter in virtual field resolvers", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            contextParser: z.object({
                userId: z.string(),
            }),
            virtualFields: {
                ids: {
                    resolve: async (row, ctx) => {
                        expect(ctx).toEqual({
                            userId: 'z'
                        });
                        expectTypeOf(ctx).toEqualTypeOf<{ userId: string } | undefined>();
                        return Promise.resolve(row.id + row.uid);
                    },
                    dependencies: ["id", "uid"],
                }
            }
        });
        const query = await loader.load({
            take: 1,
            ctx: {
                userId: 'z',
            },
            select: ['ids'],
        });
        expect(query[0]).toEqual(expect.objectContaining({
            ids: expect.any(String),
        }));
        expect(query[0]?.ids).toEqual(expect.any(String));
        expect(loader.getSelectableFields()).toContain("ids");
        expectTypeOf(query[0]).toHaveProperty("ids");
        expectTypeOf(query[0].ids).toEqualTypeOf<string>();
    });

    it("Allows returning promises from virtual fields", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            virtualFields: {
                ids: {
                    resolve: async (row) => {
                        return Promise.resolve(row.id + row.uid);
                    },
                    dependencies: ["id", "uid"],
                }
            }
        });
        const query = await loader.load({
            take: 1,
            select: ['ids'],
        });
        expect(query[0]).toEqual(expect.objectContaining({
            ids: expect.any(String),
        }));
        expect(query[0]?.ids).toEqual(expect.any(String));
        expect(loader.getSelectableFields()).toContain("ids");
        expectTypeOf(query[0]).toHaveProperty("ids");
        expectTypeOf(query[0].ids).toEqualTypeOf<string>();
    });

    it("Supports multiple (mixed) virtual fields", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            virtualFields: {
                ids: {
                    resolve: async (row) => {
                        return Promise.resolve(row.id + row.uid);
                    },
                    dependencies: ["id", "uid"],
                },
                field: {
                    resolve: row => row.id,
                    dependencies: ["id"],
                }
            }
        });
        const query = await loader.loadPagination({
            take: 1,
            select: ['ids', 'field'],
        });
        expect(query.nodes[0]).toEqual(expect.objectContaining({
            ids: expect.any(String),
            field: expect.any(Number),
        }));
        expect(query.nodes[0]?.ids).toEqual(expect.any(String));
        expect(query.nodes[0]?.field).toEqual(expect.any(Number));
        expect(loader.getSelectableFields()).toContain("ids");
        expectTypeOf(query.nodes[0]).toHaveProperty("ids");
        expectTypeOf(query.nodes[0]).toEqualTypeOf<{ ids: string, field: number }>();
    });

    it("Allows selecting fields", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.fragment`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            contextFactory: (ctx) => ({
                ...ctx,
                newField: 'bob',
            }),
            type: zodType,
        });
        const query = await loader.loadPagination({
            select: ['value'],
            skip: 1,
            take: 1
        });
        expectTypeOf(query.nodes[0]).toEqualTypeOf<{ value: string }>();
        expect(loader.getSelectableFields()).not.toContain("someOtherField")
        expectTypeOf(loader.getSelectableFields()[0]).toEqualTypeOf<["id", "uid", "value"][number]>()
    });

    it("Warns if there's a semicolon at the end of the select query", async () => {
        const origWarn = console.warn;
        console.warn = jest.fn();
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.fragment`SELECT *;`,
            },
            type: zodType,
        });
        await expect(loader.load({
            select: ['value', 'id'],
            take: 1
        })).rejects.toThrow("syntax error at or near");
        expect(console.warn).toHaveBeenCalledTimes(2);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Your query includes semicolons"));
        expect(console.warn).toHaveBeenLastCalledWith(expect.stringContaining("Specify query.from"), expect.anything());
        console.warn = origWarn;
    });

    it("Errors if some fields cannot be parsed", async () => {
        const origError = console.warn;
        console.error = jest.fn();
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.fragment`SELECT id`,
                from: sql.fragment`FROM test_table_bar`,
            },
            type: z.object({
                id: z.string(),
            }),
        });
        await expect(loader.load({
            take: 1,
        })).rejects.toThrow(/Query returned rows that do not conform/);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Expected string, received number"));
        console.error = origError;
    });

    it("Doesn't check if parser is missing", async () => {
        const data = await db.any(sql.fragment`SELECT 3 as number;` as any);
        expect(data).toEqual([{
            number: 3
        }]);
    });

    it("Throws error if invalid zod type is provided", async () => {
        expect(() => makeQueryLoader({
            db,
            query: {
                select: sql.fragment`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            type: z.string() as any,
        })).toThrow(`Invalid query type provided:`);
    });

    it("Throws error if DB is not provided", async () => {
        const loader = makeQueryLoader({
            query: {
                select: sql.fragment`SELECT *;`,
            },
            type: zodType,
        });
        await expect(loader.load({
            select: ['value', 'id'],
            take: 1
        })).rejects.toThrow("Database not provided");
        await expect(loader.loadPagination({
            select: ['value', 'id'],
            take: 1
        })).rejects.toThrow("Database not provided");
    });

    it("Throws errors that occur in virtual fields", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.fragment`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            type: zodType,
            virtualFields: {
                ids: {
                    async resolve() {
                        return Promise.reject('Error fetching!');
                    },
                    dependencies: [],
                }
            }
        });

        await expect(loader.load({
            select: ['value', 'ids'],
            take: 1
        })).rejects.toEqual("Error fetching!");
    });

    it("Allows ordering by specified columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                value: ["test_table_bar", "value"],
            },
        });
        await expect(loader.getQuery({
            // @ts-expect-error id is not sortable
            orderBy: ["id", "ASC"],
        })).rejects.toThrow();
        expect((await loader.getQuery({
            orderBy: ["value", "DESC"],
        })).sql).toContain(`"value" DESC`)
    });

    it("Allows ordering by multiple columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                value: ["test_table_bar", "value"],
                id: "id",
            },
        });
        expect((await loader.getQuery({
            orderBy: [["id", "ASC"], ["value", "DESC"]],
        })).sql).toContain(`"id" ASC, "test_table_bar"."value" DESC`);
        expect((await loader.getQuery({
            orderBy: ["value", "DESC"],
        })).sql).toContain(`"value" DESC`)
        expect(await loader.load({
            orderBy: [["value", "DESC"], ["id", "ASC"]],
        })).toMatchSnapshot();
    });

    it("Allows using sql fragment for specifying sortable columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                value: sql.fragment`COALESCE("uid", "value")`,
                id: "id",
            },
        });
        expect((await loader.getQuery({
            orderBy: [["id", "ASC"], ["value", "DESC"]],
        })).sql).toContain(`"id" ASC, COALESCE("uid", "value") DESC`);
        expect((await loader.getQuery({
            orderBy: ["value", "DESC"],
        })).sql).toContain(`COALESCE("uid", "value") DESC`)
        expect(await loader.load({
            orderBy: [["value", "DESC"], ["id", "ASC"]],
        })).toMatchSnapshot();
    });

    it("Allows sorting by non-selectable columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT id, uid, value`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                date: "date"
            },
        });
        await expect(loader.getQuery({
            // @ts-expect-error value is not sortable
            orderBy: ["value", "ASC"]
        })).rejects.toThrow();
        expect((await loader.getQuery({
            orderBy: ["date", "DESC"],
        })).sql).toContain(`"date" DESC`);
        expect(await loader.load({
            orderBy: ["date", "DESC"],
        })).toEqual(expect.arrayContaining([]));
    });

    it("Doesn't allow invalid sort direction", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT id, uid`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                date: "date"
            },
        });
        await expect(loader.getQuery({
            // @ts-expect-error blabla is not a valid sort direction
            orderBy: ["date", "blabla"]
        })).rejects.toThrow(/Invalid enum value./);
    });

    it("Allows defining filters", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            filters: {
                filters: {
                    largeIds: z.boolean(),
                    id: z.number(),
                },
                interpreters: {
                    largeIds: (filter) => filter ? sql.fragment`"id" > 5` : sql.fragment``,
                    id: num => num ? sql.fragment`"id" = ${num}` : sql.fragment``,
                }
            }
        });
        const query = await await loader.getQuery({
            take: 1,
            where: {
                largeIds: true,
            }
        });
        expect(query.sql).toContain('"id" > 5');
        const result = await loader.load({
            select: ['value', 'id'],
            take: 1,
            where: {
                id: 8,
                largeIds: true,
            }
        });
        expectTypeOf(result[0]).toEqualTypeOf<{ value: string, id: number }>();
        expect(result[0].id).toEqual(8);
    });

    const genericOptions = createOptions({
        db,
        query: {
            select: sql.type(zodType)`SELECT *`,
            from: sql.fragment`FROM test_table_bar`,
        },
        plugins: [
            useSlowQueryPlugin({
                slowQueryThreshold: 2,
            }),
        ],
        constraints() {
            return sql.fragment`TRUE`;
        },
        columnGroups: {
            ids: ["id", "uid"],
            values: ["id", "dummyField"],
        },
        options: {
            runtimeCheck: true,
        },
        filters: {
            filters: {
                largeIds: z.boolean(),
                id: z.number(),
            },
            interpreters: {
                largeIds: (filter) => filter ? sql.fragment`"id" > 5` : null,
                id: num => num ? sql.fragment`"id" = ${num}` : null,
            }
        },
        virtualFields: {
            dummyField: {
                resolve: (row) => {
                    return row.uid + row.id;
                },
                dependencies: ["id", "uid"],
            }
        },
    } as const);

    it("Selects all fields if select is unspecified", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const result = await loader.load({});
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0].uid).toEqual(expect.any(String));
        expect(result[0].value).toEqual(expect.any(String));
        expectTypeOf(result[0]).toMatchTypeOf<{ uid: string, id: number, value: string, dummyField: any }>();
        expectTypeOf(result[0] as InferPayload<typeof loader, any>).toMatchTypeOf<{ uid: string, id: number, value: string, dummyField: any }>();
    });

    it("Doesn't work well if select is conditional with empty array (needs as any assertion to select all) (BUG)", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const someCondition = true;
        const result = await loader.load({
            select: someCondition ? [] : ["id"] as any,
        });
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0].value).toEqual(expect.any(String));
        expectTypeOf(result[0]).toMatchTypeOf<{ id: number, value: string, uid: string, dummyField: any }>();
    });

    it("Selects dependent fields", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            options: {
                ...genericOptions.options,
                runtimeCheck: false,
            }
        });
        const result = await loader.load({
            select: ["dummyField"],
        });
        // @ts-expect-error id is not selected specifically, so it throws type error.
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0]).toEqual(expect.objectContaining({
            id: expect.any(Number),
            uid: expect.any(String),
            dummyField: expect.any(String),
        }));
        // No need to add dependent fields to type, even if they're actually present.
        expectTypeOf(result[0]).toMatchTypeOf<{ dummyField: any }>();
        expect(result[0].dummyField).toEqual(expect.any(String));
        // No need to have the type in this case
        // @ts-expect-error uid is excluded
        expect((result[0]).uid).toEqual(expect.any(String));
        expectTypeOf(result[0]).toEqualTypeOf<InferPayload<typeof loader, {
            select: ["dummyField"],
        }>>();
    });

    // Filters

    const filterOptions = createFilters()({
        id: arrayifyType(z.number()),
        uid: arrayifyType(z.string()),
        largeIds: z.boolean(),
        date: dateFilterType
    }, {
        id: (ids) => arrayFilter(ids, sql.fragment`"id"`, 'numeric'),
        date: (date) => dateFilter(date, sql.fragment`"date"`),
        // If true is specified, id must be greater than 5
        largeIds: (filter) => booleanFilter(filter, sql.fragment`"id" > 5`),
        uid: (uids) => arrayFilter(uids, sql.fragment`"uid"`),
    });
    const getConditions = makeFilter(filterOptions.interpreters, filterOptions.options);
    type Filter = Parameters<typeof getConditions>[0];

    const testFilters = (filter: Filter) => {
        const loader = makeQueryLoader({
            ...genericOptions,
            filters: filterOptions,
        });
        return loader.load({
            where: filter,
        });
    }

    it("Filters on single fields", async () => {
        const items = await testFilters({
            id: 3,
        });
        expect(items).toEqual([expect.objectContaining({
            id: 3,
        })]);
    });

    it("Doesn't validate the filter input for the wrong types (BUG)", async () => {
        const items = await testFilters({
            // @ts-expect-error id is not a string
            id: "3",
        });
        expect(items).toEqual([expect.objectContaining({
            id: 3,
        })]);
    });

    it("Filters on array fields", async () => {
        const items = await testFilters({
            uid: ['x', 'z'],
        });
        expect(items).toEqual([expect.objectContaining({
            uid: 'z',
        }), expect.objectContaining({
            uid: 'x',
        })]);
    });

    it("Filters on date fields", async () => {
        const items = await testFilters({
            date: {
                _lt: "1990-01-01",
            },
        });
        expect(items).toEqual([]);
    });

    it("OR filters work", async () => {
        const items = await testFilters({
            OR: [{
                id: 3,
            }, {
                id: [3, 2],
            }]
        });
        expect(items).toEqual([expect.objectContaining({
            id: 2,
        }), expect.objectContaining({
            id: 3,
        })]);
    })

    // Pagination


    it("Doesn't return total count if unspecified", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                value: ["test_table_bar", "value"],
            }
        });
        const query = await loader.loadPagination({
            select: ['value'],
            orderBy: ["value", "ASC"],
            take: 5
        });
        expect(query.pageInfo.minimumCount).toEqual(expect.any(Number));
        expect(query.pageInfo.count).toBeNull();
        const loaded = await loader.load({
            select: ['value'],
            take: 5,
        });
        expect(loaded).toEqual(query.nodes);
    });

    it("Returns total count if specified", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const take = 5;
        const skip = 2;
        const query = await loader.loadPagination({
            select: ['value'],
            takeCount: true,
            skip,
            take
        });
        expect(query.pageInfo.count).toEqual(9);
        expect(query.pageInfo.minimumCount).toEqual(take + skip + 1);
    });

    it("Returns true total count even if skip is higher than that, minimumCount equal to skip", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const take = 5;
        const skip = 200;
        const query = await loader.loadPagination({
            takeCount: true,
            skip,
            take
        });
        expect(query.pageInfo.count).toEqual(9);
        expect(query.pageInfo.minimumCount).toEqual(skip);
    });

    it("Returns all keys if type is a zod.any() type (intentional skipping)", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(z.any())`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
        });
        const take = 1;
        const query = await loader.loadPagination({
            takeCount: true,
            take
        });
        expect(query.nodes).toEqual([{
            id: 1,
            uid: "z",
            value: "aaa",
            date: expect.anything(),
        }]);
    });

    it("Returns query without using lateral join if sqlite", async () => {
        const loader = makeQueryLoader({
            db,
            options: {
                useSqlite: true,
            },
            sortableColumns: {
                id: "id",
            },
            query: {
                select: sql.type(z.any())`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
        });
        const take = 1;
        const query = await await loader.getQuery({
            takeCursors: true,
            take,
            orderBy: ["id", "ASC"],
        });
        expect(query.sql).toContain("cursorcolumns");
        expect(query.sql.toUpperCase()).not.toContain("LATERAL");
    });
    it("Returns minimal count as skip + nodes.length + 1 normally", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                userid: "uid",
            },
        });
        const query = await loader.loadPagination({
            select: ['value'],
            orderBy: ["userid", "DESC"],
            take: 5
        });
        expect(query.pageInfo.minimumCount).toEqual(query.nodes.length + 1);
        expect(query.pageInfo.count).toBeNull();
        const keys = Object.keys(query.nodes[0]);
        expect(keys).toEqual(expect.arrayContaining(["value"]));
        expect(keys).toHaveLength(1);
    });

    it("Returns minimal count based on next N pages if specified", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const take = 3;
        const takeNextPages = 2;
        const query = await loader.loadPagination({
            select: ['value'],
            take,
            takeCount: true,
            takeNextPages,
        });
        expect(query.pageInfo.minimumCount).toEqual(query.nodes.length + take*(takeNextPages-1) +1);
        expect(query.pageInfo.count).toBeDefined();
        expect(query.nodes[1].value).toEqual(expect.any(String));
        expectTypeOf(query.nodes[0]).toEqualTypeOf<{ value: string }>();
        expect(query.pageInfo.hasNextPage).toEqual(true);
    });

    // getLoadArgs

    it("Doesn't allow filtering by unknown columns", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            selectableColumns: ["id", "dummyField"],
            sortableColumns: {
                id: "id",
            },
        });
        const parser = loader.getLoadArgs({
            sortableColumns: ["id"],
            // Allows whatever columns here...Intentional
            selectableColumns: ["id", "value", "asdf"],
        });
        const parsed = parser.parse({
            select: ["asdf"],
            where: {
                largeIds: true,
                someOtherField: null,
            },
        });
        expect(parsed).toEqual({
            select: ["asdf"],
            where: {
                largeIds: true,
            },
        });
        expectTypeOf(parsed.where).toMatchTypeOf<{ AND?: any, OR?: any, NOT?: any, id?: any, largeIds?: any } | undefined>();
        expectTypeOf(parsed.select?.[0]).toEqualTypeOf<"id" | "value" | "asdf" | undefined>();

        expectTypeOf((parsed as InferArgs<typeof loader>).select?.[0]).toEqualTypeOf<"dummyField" | "id" | undefined>();
        expectTypeOf(parsed.where).toMatchTypeOf<InferArgs<typeof loader>["where"] | undefined>();
        expectTypeOf(parsed.orderBy).toMatchTypeOf<InferArgs<typeof loader>["orderBy"] | undefined>();
        expectTypeOf(parsed.searchAfter).toMatchTypeOf<InferArgs<typeof loader>["searchAfter"] | undefined>();
        expectTypeOf(parsed.selectGroups).toMatchTypeOf<InferArgs<typeof loader>["selectGroups"] | undefined>();
    });

    it("Doesn't allow filtering when no filters are specified", async () => {
        const loader = makeQueryLoader({
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
        });
        const parser = loader.getLoadArgs();
        const parsed = parser.parse({
            where: null,
        });
        expect(parser.parse({
            where: undefined,
        })).toEqual({
            where: undefined,
        });
        expect(() => parser.parse({
            where: {
                id: 3,
            },
        })).toThrow(/received object/);
        expectTypeOf(parsed.where).toEqualTypeOf<undefined>();
    });

    it("Doesn't allow invalid types", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            selectableColumns: ["id", "uid"],
            sortableColumns: {
                id: "id",
            }
        });
        const parser = loader.getLoadArgs({
            sortableColumns: ["id"],
        });
        const where = {
            id: 'invalidType',
            largeIds: true,
            someOtherField: null,
        }
        expect(() => parser.parse({
            where,
        })).toThrowErrorMatchingSnapshot();
    });

    it("Doesn't allow sorting by unallowed columns", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                value: "value",
            }
        });
        const parser = loader.getLoadArgs({
            sortableColumns: ["value"],
            selectableColumns: ["id", "asdf"],
        });
        expect(() => parser.parse({
            orderBy: ["id", "ASC"],
            select: ["asdf", "id"],
        })).toThrowErrorMatchingSnapshot();
        await expect(loader.getQuery({
            orderBy: [["id", "ASC"]] as any,
        })).rejects.toThrow(/Invalid enum value/);
    });

    it("Allows sorting by valid columns", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                id: "id",
            }
        });
        const parser = loader.getLoadArgs({
            sortableColumns: ["id"],
        });
        const parsed = parser.parse({
            orderBy: ["id", "ASC"],
            selectGroups: ["ids"],
        });
        expect(parsed).toEqual({
            orderBy: [["id", "ASC"]],
            selectGroups: ["ids"],
        });
        expectTypeOf(parsed.selectGroups?.[0]).toEqualTypeOf<"ids" | "values" | undefined>();
        expectTypeOf(parsed.orderBy).toMatchTypeOf<["id", string] | null | undefined | (["id", string] | null | undefined)[]>();
        expectTypeOf(parsed.select?.[0]).toEqualTypeOf<"id" | "uid" | "value" | "dummyField" | undefined>();
    });

    it("Allows empty array in orderBy", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                id: "id",
            }
        });
        const parser = loader.getLoadArgs({
            sortableColumns: ["id"],
        });
        const parsed = parser.parse({
            orderBy: [],
            selectGroups: ["ids"],
        });
        expect(parsed).toEqual({
            orderBy: [],
            selectGroups: ["ids"],
        });
        expectTypeOf(parsed.selectGroups?.[0]).toEqualTypeOf<"ids" | "values" | undefined>();
        expectTypeOf(parsed.orderBy).toMatchTypeOf<["id", string] | null | undefined | (["id", string] | null | undefined)[]>();
        expectTypeOf(parsed.select?.[0]).toEqualTypeOf<"id" | "uid" | "value" | "dummyField" | undefined>();
    });

    it("Doesn't allow sorting with invalid directions", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const parser = loader.getLoadArgs({
            // @ts-expect-error id is not sortable
            sortableColumns: ["id"],
        });
        expect(() => parser.parse({
            orderBy: ["id", "; DELETE * FROM users"],
        })).toThrowErrorMatchingSnapshot();
    });

    it("Allows sorting with multiple columns", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                value: "value",
                id: "id",
            }
        });
        const parser = loader.getLoadArgs({});
        const parsed = parser.parse({
            orderBy: [["id", "ASC"], ["value", "DESC"]],
        });
        expect(parsed).toEqual({
            orderBy: [["id", "ASC"], ["value", "DESC"]],
        });
        expectTypeOf(parsed.orderBy?.[0]).toMatchTypeOf<["id" | "value", string] | "value" | "id" | null | undefined>();
        expectTypeOf(parsed.select?.[0]).toEqualTypeOf<"id" | "uid" | "value" | "dummyField" | undefined>();
    });

    it("Allows disabling filters", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                value: "value",
                id: "id",
            }
        });
        const parser = loader.getLoadArgs({
            disabledFilters: {
                OR: true,
            }
        });
        const parsed = parser.parse({
            where: {
                OR: [{
                    id: 2,
                }],
                AND: [{
                    id: 4,
                    OR: [{
                        id: 3,
                    }]
                }]
            },
        });
        expect(parsed).toEqual({
            where: {
                AND: [{
                    id: 4,
                }]
            },
        });
        // @ts-expect-error OR is not defined
        expect(parsed.where?.OR).toBeUndefined();
    });

    it("Allows sorting with a single column as array", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                value: "value",
                id: "id",
            }
        });
        const parser = loader.getLoadArgs({});
        const parsed = parser.parse({
            orderBy: [["id", "DESC"]],
        });
        expect(parsed).toEqual({
            orderBy: [["id", "DESC"]],
        });
        expectTypeOf(parsed.orderBy?.[0]).toMatchTypeOf<["id" | "value", string] | "value" | "id" | null | undefined>();
        expectTypeOf(parsed.select?.[0]).toEqualTypeOf<"id" | "uid" | "value" | "dummyField" | undefined>();
    });

    it("Allows transforming the sort columns as array", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                value: "value",
                id: "id",
            }
        });
        const parser = loader.getLoadArgs({
            transformSortColumns(columns) {
                expectTypeOf(columns).toEqualTypeOf<["value" | "id", "ASC" | "DESC"][] | null | undefined>();
                if (Array.isArray(columns)) {
                    return [...columns, ["id", "ASC"]];
                }
                return columns;
            }
        });
        const parsed = parser.parse({
            orderBy: ["value", "DESC"],
        });
        expect(parsed).toEqual({
            orderBy: [["value", "DESC"], ["id", "ASC"]],
        });
        expect(parser.parse({
            orderBy: [["value", "DESC"], ["id", "ASC"]],
        })).toEqual({
            orderBy: [["value", "DESC"], ["id", "ASC"], ["id", "ASC"]],
        });
        expectTypeOf(parsed.orderBy?.[0]).toMatchTypeOf<["id" | "value", string] | "value" | "id" | null | undefined>();
    });

    it("Allows specifying the selectable columns, and only allows selecting those", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            selectableColumns: ["id"]
        });
        const parser = loader.getLoadArgs({});
        expect(() => parser.parse({
            select: ["id", "uid"]
        })).toThrow(/uid/)
        expect(Object.keys(await loader.load({
            // @ts-expect-error  uid is not selectable
            select: ["id", "uid"],
        }))).not.toContain("uid");
        const parsed = parser.parse({
            select: ["id"]
        });
        expectTypeOf(parsed.select).toMatchTypeOf<['id'][number][] | undefined>();
    });

    it("Allows overwriting the selectable columns in get load args", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            selectableColumns: ["id"]
        });
        const parser = loader.getLoadArgs({
            selectableColumns: ["uid"]
        });
        const parsed = parser.parse({
            select: ["uid"]
        });
        expect(parsed).toEqual({
            select: ["uid"]
        });
        expectTypeOf(parsed.select?.[0]).toEqualTypeOf<"uid" | undefined>();
    });

    it("Disallows selecting non-existent groups", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const parser = loader.getLoadArgs({});
        expect(() => parser.parse({
            selectGroups: ["invalidGroup"]
        })).toThrow(/Invalid enum/);
    });

    it("Allows selecting many groups", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            columnGroups: {
                one: ["dummyField", "id"],
                two: ["id", "uid"],
            }
        });
        const parser = loader.getLoadArgs({});
        const parsed = parser.parse({
            selectGroups: ["one", "two"]
        });
        expectTypeOf(parsed.selectGroups?.[0]).toEqualTypeOf<"one" | "two" | undefined>();
        expect(parsed).toEqual({
            selectGroups: ["one", "two"],
        });
    });

    // getSelectableFields

    it("returns all the fields as selectable by default", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const selectable = loader.getSelectableFields();
        expect(selectable).toEqual(expect.arrayContaining(["id", "uid", "dummyField", "value"]));
        expectTypeOf(selectable[0]).toEqualTypeOf<["id", "uid", "value", "dummyField"][number]>();
        expect(selectable).toHaveLength(4);
    });

    it("returns only the fields that are specified as selectable", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            selectableColumns: ["id", "uid"],
        });
        const selectable = loader.getSelectableFields();
        expect(selectable).toEqual(expect.arrayContaining(["id", "uid"]));
        expectTypeOf(selectable).toEqualTypeOf<["id" | "uid", ...("id" | "uid")[]]>();
        expect(selectable).toHaveLength(2);
    });

    it("If fields are specified as non-selectable, shouldn't be allowed to be selected", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            selectableColumns: ["id", "uid"],
        });
        const selectable = await loader.getQuery({
            // @ts-expect-error value is not selectable
            select: ["id", "value", "uid"]
        });
        expect(selectable.sql).not.toContain("value");
        expect(selectable.sql).toContain("uid");
    });

    it("Group columns can still be selected explicitly", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const data = await loader.load({
            take: 1,
            select: ["uid"],
            selectGroups: ["ids"]
        }).then(a => a[0]);
        expect(data.uid).toEqual(expect.any(String));
        expectTypeOf(data).toEqualTypeOf<{ uid: string, id: number }>();
        expectTypeOf(data).toEqualTypeOf<InferPayload<typeof loader, {
            select: ["uid"],
            selectGroups: ["ids"],
        }>>();
    });

    it("Allows specifying context parser", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            contextParser: z.object({
                userId: z.string(),
                newField: z.string(),
            }),
            contextFactory: (ctx) => ({
                ...ctx,
                newField: 'bob',
            }),
            filters: {
                ...genericOptions.filters,
                options: {
                    postprocess(conditions, filters, context) {
                        expectTypeOf(context).toEqualTypeOf<{ userId?: string, newField: string }>();
                        expect(context).toEqual({ userId: "bla", newField: 'bob' });
                        return conditions;
                    },
                }
            }
        });
        const data = await loader.load({
            take: 1,
            select: ["uid"],
            ctx: {
                userId: "bla",
                // @ts-expect-error extra field
                extraField: "disallowed without passthrough",
            }
        }).then(a => a[0]);
        expect(data.uid).toEqual(expect.any(String));
        expectTypeOf(data).toEqualTypeOf<{ uid: string }>();
        expectTypeOf(data).toEqualTypeOf<InferPayload<typeof loader, {
            select: ["uid"],
        }>>();
    });

    it("Passes the context and filters to filter postprocessing", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            plugins: [useSlowQueryPlugin()],
            filters: {
                ...genericOptions.filters,
                options: {
                    postprocess(conditions, filters, context) {
                        expect(context).toEqual({ userId: "bla" });
                        expect(conditions.map(u => u.sql)).toEqual(['"id" > 5', 'NOT ("id" > 5)']);
                        expect(filters).toEqual({
                            largeIds: true,
                            NOT: {
                                largeIds: true,
                            }
                        });
                        expectTypeOf(filters).toMatchTypeOf<{
                            largeIds?: boolean, id?: number, AND?: any[], OR?: any[], NOT?: any
                        } | undefined>();
                        return conditions;
                    },
                }
            }
        });
        const data = await loader.load({
            take: 1,
            where: {
                largeIds: true,
                NOT: {
                    largeIds: true,
                }
            },
            select: ["uid"],
            ctx: {
                userId: "bla",
            }
        }).then(a => a[0]);
        expect(data).toBeUndefined();
        expectTypeOf(data).toEqualTypeOf<{ uid: string }>();
    });

    it("Query parser is type-safe by default", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            }
        });
        const query = await loader.getQuery({
            select: ['id'],
            take: 1,
        });

        const data = await db.any(query);
        expectTypeOf(data[0]).toEqualTypeOf<{ id: number }>();
        expect(data).toEqual([{ id: expect.any(Number) }]);
        expectTypeOf(data[0]).toEqualTypeOf<InferPayload<typeof loader, {
            select: ["id"],
        }>>();
    });

    it("Loads cursor-based with group by", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(z.object({
                    value: z.string(),
                    count: z.number(),
                }))`SELECT value, COUNT(*)`,
                from: sql.fragment`FROM test_table_bar`,
                groupBy: () => sql.fragment`test_table_bar.value`,
            },
            filters: genericOptions.filters,
            sortableColumns: {
                value: "value",
            }
        });
        const data = await loader.loadPagination({
            select: ["value", "count"],
            takeCursors: true,
            orderBy: ["value", "ASC"],
            where: {
                largeIds: true,
            },
        });
        expect(data).toEqual({
            cursors: [
                "eyJ2YWx1ZSI6ImNjYyJ9",
                "eyJ2YWx1ZSI6ImRkZCJ9",
                "eyJ2YWx1ZSI6ImVlZSJ9",
            ],
            nodes: [{
                count: 1,
                value: "ccc",
            }, {
                count: 2,
                value: "ddd",
            }, {
                count: 1,
                value: "eee",
            }],
            pageInfo: {
                count: null,
                endCursor: "eyJ2YWx1ZSI6ImVlZSJ9",
                startCursor: "eyJ2YWx1ZSI6ImNjYyJ9",
                hasNextPage: false,
                hasPreviousPage: false,
                minimumCount: 3,
            },
        });
    });

    it("Loads data grouped by", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(z.object({
                    value: z.string(),
                    count: z.number(),
                }))`SELECT value, COUNT(*)`,
                from: sql.fragment`FROM test_table_bar`,
                groupBy: sql.fragment`test_table_bar.value`,
            },
            sortableColumns: {
                value: "value",
            },
            filters: genericOptions.filters,
        });
        const data = await loader.load({
            orderBy: ["value", "ASC"]
        });
        expect(data).toEqual([{
                count: 2,
                value: "aaa",
            }, {
                count: 2,
                value: "bbb",
            }, {
                count: 2,
                value: "ccc",
            }, {
                count: 2,
                value: "ddd",
            }, {
                count: 1,
                value: "eee",
            }]);
    });

    it("Loads by cursor-based pagination when sorted by a single column", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: "id",
            }
        });
        const data = await loader.load({
            select: ['id'],
            searchAfter: {
                id: 5,
                // @ts-expect-error non-existing value specified
                invalidValue: 'string',
            },
            take: 1,
            orderBy: ["id", "ASC"]
        });
        expect(data).toEqual([{
            id: 6,
        }]);
    });

    it("Loads by cursor-based pagination with multiple columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: "id",
                value: sql.fragment`"value"`,
            }
        });
        const args = {
            select: ['id', 'value'] as const,
            searchAfter: {
                id: 2,
                value: "aaa",
            },
            takeCount: true,
            take: 1,
            orderBy: [["value", "DESC"], ["id", "DESC"]] as const
        } as const;
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        const data = await loader.loadPagination(parsed);
        const query = await loader.getQuery(args);
        expect(data).toEqual({
            nodes: [{
                id: 1,
                value: "aaa",
            }],
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: false,
                minimumCount: 1,
                count: 9,
            },
        });
        expect(query.sql).toContain(`("value" < $1) OR ("value" = $2 AND "id" < $3)`)
        expect(query.sql).toContain(`ORDER BY "value" DESC, "id" DESC`)
        expect(args).toEqual(parsed);
        expectTypeOf(data.nodes[0] as InferPayload<typeof loader, {
            select: ["id", "value"],
        }>).toEqualTypeOf<{ id: number, value: string }>();
    });

    it("Loads cursor-based even when sorted by complex expression column", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT id, uid, value`,
                from: sql.fragment`FROM test_table_bar`,
            },
            defaults: {
                take: 1,
            },
            sortableColumns: {
                id: "id",
                upperValue: sql.fragment`UPPER("value")`,
            },
        });
        const args = {
            select: ['id', 'value'] as const,
            searchAfter: {
                id: 2,
                upperValue: "AAA",
            },
            orderBy: [["upperValue", "DESC"], ["id", "DESC"]] as const
        };
        const query = await loader.getQuery(args);
        expect(query.sql).toContain(`(UPPER("value") < $1) OR (UPPER("value") = $2 AND "id" < $3)`)
        expect(query.sql).toContain(`ORDER BY UPPER("value") DESC, "id" DESC`)
        const data = await loader.loadPagination(args);
        expectTypeOf(data.nodes[0]).toEqualTypeOf<{ id: number, value: string }>();
        expect(data).toEqual({
            nodes: [{
                id: 1,
                value: "aaa",
            }],
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: false,
                minimumCount: 1,
                count: null,
            },
        });
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        expect(args).toEqual(parsed);
        expectTypeOf(data.nodes[0]).toEqualTypeOf<InferPayload<typeof loader, {
            select: ["id", "value"],
        }>>();
    });

    it("Reverses the order when take parameter is negative, while returning items in the original order", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: {
                    field: sql.fragment`"id"`,
                    nullable: true,
                    nullsLast: true,
                },
                upperValue: sql.fragment`UPPER(test_table_bar."value")`,
            },
        });
        const args = {
            select: ['id', 'value'] as const,
            searchAfter: {
                id: 2,
                upperValue: "AAA",
            },
            take: -2,
            orderBy: [["upperValue", "DESC"], ["id", "ASC"]] as const
        };
        const query = await loader.getQuery(args);
        expect(query.sql).toContain(`(UPPER(test_table_bar."value") > $1) OR (UPPER(test_table_bar."value") = $2 AND ("id" < $3 OR "id" IS NULL))`)
        expect(query.sql).toContain(`ORDER BY UPPER(test_table_bar."value") ASC, "id" DESC`)
        const data = await loader.loadPagination(args);
        expect(data).toEqual({
            nodes: [{
                id: 4,
                value: "bbb",
            }, {
                id: 1,
                value: "aaa"
            }],
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: true,
                minimumCount: 3,
                count: null,
            },
        });
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        expect(args).toEqual(parsed);
    });

    it("Negative take doesn't work when sorting isn't specified", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: "id",
                upperValue: sql.fragment`UPPER("value")`,
            }
        });
        // eslint-disable-next-line
        expect(loader.loadPagination({
            take: -2,
            select: ['id', 'value'],
        })).rejects.toThrow(/orderBy must be specified/);
        // eslint-disable-next-line
        expect(loader.getQuery({
            take: -2,
            select: ['id'],
        })).rejects.toThrow(/orderBy must be specified/);
    });

    it("Cursor-based pagination doesn't work properly if searchAfter values aren't specified (NOT A BUG) (UNSPECIFIED BEHAVIOR, MAY CHANGE)", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: {
                    field: sql.fragment`"id"`,
                    nullable: true,
                },
                value: sql.fragment`"value"`,
            }
        });
        const args = {
            select: ['id', 'value'] as const,
            searchAfter: {
                id: 2,
            },
            take: 1,
            orderBy: [["id", "ASC"], ["value", "ASC"]] as const
        };
        const data = await loader.loadPagination(args);
        const query = await loader.getQuery(args);
        expect(data).toEqual({
            nodes: [{
                id: 2,
                value: "aaa"
            }],
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: true,
                minimumCount: 2,
                count: null,
            },
        });
        expect(query.sql).toContain(`(("id" > $1 OR "id" IS NULL)) OR ("id" = $2 AND TRUE)`)
        expect(query.sql).toContain(`ORDER BY "id" ASC, "value" ASC`)
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        expect(args).toEqual(parsed);
    });

    it("Cursor-based pagination doesn't work properly if searchAfter values aren't specified for primary column (NOT A BUG) (UNSPECIFIED BEHAVIOR, MAY CHANGE)", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: {
                    field: sql.fragment`"id"`,
                    nullable: true,
                },
                value: sql.fragment`"value"`,
            }
        });
        const args = {
            select: ['id', 'value'] as const,
            searchAfter: {
                value: "bbb",
                id: null,
            },
            take: 1,
            takeCount: true,
            orderBy: [["id", "ASC"], ["value", "ASC"]] as const
        };
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        const query = await loader.getQuery(parsed);
        // nulls sort as if larger than any non-null value. 
        // So NULLS FIRST is the default for DESC order, and NULLS LAST otherwise
        expect(query.sql).toContain(`("id" IS NULL) OR ("id" IS NOT NULL AND "value" > $1)`)
        expect(query.sql).toContain(`ORDER BY "id" ASC, "value" ASC`)
        expectTypeOf(parsed.where).toEqualTypeOf<undefined>();
        const data = await loader.loadPagination(args);
        expect(data).toEqual({
            nodes: [{
                id: 5,
                value: "ccc"
            }],
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: true,
                minimumCount: 2,
                count: expect.any(Number),
            },
        });
        expectTypeOf(data.nodes[0]).toEqualTypeOf<InferPayload<typeof loader, {
            select: ["id", "value"],
        }>>();
        expect(args).toEqual(parsed);
    });


    it("Cursor-based pagination tries to work with nullable columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(z.object({
                    id: z.string().nullish(),
                    date_of_birth: z.number().nullish(),
                    email: z.string().nullish(),
                }))`SELECT id, date_of_birth, email`,
                from: sql.fragment`FROM users`,
            },
            sortableColumns: {
                id: "id",
                email: "email",
                dateOfBirth: {
                    field: sql.fragment`"date_of_birth"`,
                    nullable: true,
                    nullsLast: true,
                }
            }
        });
        const firstPage = await loader.loadPagination({
            select: ['id', 'email', 'date_of_birth'],
            searchAfter: {
                dateOfBirth: null,
                id: "t",
            },
            take: 2,
            takeCount: true,
            takeCursors: true,
            orderBy: [["dateOfBirth", "DESC"], ["id", "ASC"]],
        });
        expect((await loader.getQuery({
            select: ['id', 'email', 'date_of_birth'],
            searchAfter: {
                dateOfBirth: null,
                email: "email",
                id: "w",
            },
            take: 1,
            takeCursors: true,
            orderBy: [["email", "ASC"], ["dateOfBirth", "DESC"], ["id", "ASC"]],
        })).sql).toContain(`("email" > $1) OR ("email" = $2 AND "date_of_birth" IS NULL) OR ("email" = $3 AND "date_of_birth" IS NOT NULL AND "id" > $4)`);
        expect(decodeCursors(firstPage.pageInfo)).toEqual({
            start: {
                dateOfBirth: "1994-05-01T00:00:00",
                id: "v",
            },
            end: {
                dateOfBirth: "1993-04-01T00:00:00",
                id: "w",
            }
        });
        expect((await loader.getQuery({
            select: ['id', 'email', 'date_of_birth'],
            searchAfter: {
                dateOfBirth: "1993-04-01",
                id: "w",
            },
            take: 2,
            orderBy: [["dateOfBirth", "ASC"], ["id", "ASC"]],
        })).sql).toContain(`(("date_of_birth" > $1 OR "date_of_birth" IS NULL)) OR ("date_of_birth" = $2 AND "id" > $3)`);
        
        const secondPage = await loader.loadPagination({
            select: ['id', 'email', 'date_of_birth'],
            searchAfter: {
                dateOfBirth: "1993-04-01",
                id: "w",
            },
            take: 2,
            takeCount: true,
            takeCursors: true,
            orderBy: [["dateOfBirth", "ASC"], ["id", "DESC"]],
        });
        expect(decodeCursors(secondPage.pageInfo)).toEqual({
            start: {
                dateOfBirth: expect.any(String),
                id: "v",
            },
            end: {
                dateOfBirth: null,
                id: "u",
            }
        });
    });

    // Column groups
    it("Allows specifying column groups and selecting them", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const data = await loader.load({
            take: 1,
            selectGroups: ["ids"]
        });
        expectTypeOf(data[0]).toEqualTypeOf<{ id: number, uid: string }>();
        expect(data[0]).toEqual({
            id: expect.any(Number),
            uid: expect.any(String),
        });
    });

    it("Works with multiple groups", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            columnGroups: {
                ids: ["id", "uid"],
                values: ["id", "dummyField"],
                all: ["dummyField", "uid"],
            },
        });
        const data = await loader.load({
            take: 1,
            selectGroups: ["ids"]
        });
        expectTypeOf(data[0]).toEqualTypeOf<{ id: number, uid: string }>();
        expect(data[0]).toEqual({
            id: expect.any(Number),
            uid: expect.any(String),
        });
        expectTypeOf(data[0]).toEqualTypeOf<InferPayload<typeof loader, {
            selectGroups: ["ids"],
        }>>();
    });

    it("Disallows selecting non-existing groups but acts as if all were selected (BUG)", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            options: {
                ...genericOptions.options,
                runtimeCheck: false,
            }
        });
        const data = await loader.loadPagination({
            take: 1,
            // @ts-expect-error nonSelectable group selected
            selectGroups: ["nonSelectable"]
        });
        // expectTypeOf(data[0]).toMatchTypeOf<{ id: number, uid: string, dummyField: any, value: string }>();
        expect(data.nodes[0]).toEqual({
            id: expect.any(Number),
            uid: expect.any(String),
            value: expect.any(String),
            dummyField: expect.anything(),
        });
        // expectTypeOf(data[0]).toEqualTypeOf<InferPayload<typeof loader, {
        //     selectGroups: any
        // }>>();
    });

    it("SelectGroups has priority", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const data = await loader.load({
            take: 1,
            selectGroups: ["ids"],
        });
        expectTypeOf(data[0]).toEqualTypeOf<{ id: number, uid: string }>();
        expect(data[0]).toEqual({
            id: expect.any(Number),
            uid: expect.any(String),
        });
        expectTypeOf(data[0]).toEqualTypeOf<InferPayload<typeof loader, {
            selectGroups: ["ids"],
        }>>();
        const ambigiousCursors: InferPayload<typeof loader> = null as any;
        expectTypeOf(ambigiousCursors).not.toHaveProperty("cursor");
    });

    // Cursor base64 API
    it("Returns cursors for each item", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                id: "id",
            }
        });
        const take = 5;
        const skip = 2;
        const query = await loader.loadPagination({
            select: ['value'],
            skip,
            takeCursors: true,
            orderBy: ["id", "ASC"],
            take
        });
        expect(query.pageInfo.startCursor).toEqual(expect.any(String));
        expect(query.pageInfo.endCursor).toEqual(expect.any(String));
        expect(query.nodes).toEqual(query.nodes.map(i => ({
            value: expect.any(String),
        })));
        expect(query.cursors).toBeDefined();
        expectTypeOf(query.cursors).toEqualTypeOf<(string | null)[] | undefined>();
    });

    it("Returns items after cursor", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: ["test_table_bar", "id"],
                value: sql.fragment`"value"`,
            }
        });
        const args = {
            takeCursors: true,
            cursor: "eyJ2YWx1ZSI6ImFhYSIsImlkIjoyfQ==",
            take: 1,
            orderBy: [["value", "DESC"], ["id", "DESC"]] as const
        } as const;
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        const data = await loader.loadPagination(parsed);
        const query = await loader.getQuery(args);
        const endCursor = data.pageInfo.endCursor;
        expect(data).toEqual({
            cursors: ["eyJpZCI6MSwidmFsdWUiOiJhYWEifQ=="],
            nodes: [{
                id: 1,
                uid: "z",
                value: "aaa",
            }],
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: false,
                minimumCount: 1,
                count: null,
                startCursor: endCursor,
                endCursor,
            },
        });

        expect(query.sql).toContain(`("value" < $1) OR ("value" = $2 AND "test_table_bar"."id" < $3)`)
        expect(query.sql).toContain(`ORDER BY "value" DESC, "test_table_bar"."id" DESC`)
        expect(args).toEqual(parsed);
        expectTypeOf(data.nodes[0] as InferPayload<typeof loader, {
            select: ["id", "value"],
            takeCursors: true,
        }>).toEqualTypeOf<{ id: number, value: string }>();
    });

    it("Can access internal columns for determining the cursor", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT test_table_bar.id, test_table_bar.uid, test_table_bar.value`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: "id",
                value: sql.fragment`"value"`,
            }
        });
        const args = {
            select: ['id', 'value'] as const,
            takeCursors: true,
            cursor: "eyJ2YWx1ZSI6ImFhYSIsImlkIjoyfQ==",
            take: 1,
            orderBy: [["value", "DESC"], ["id", "DESC"]] as const
        } as const;
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        const data = await loader.loadPagination(parsed);
        const query = await loader.getQuery(args);
        const endCursor = data.pageInfo.endCursor;
        expect(data).toEqual({
            cursors: ["eyJpZCI6MSwidmFsdWUiOiJhYWEifQ=="],
            nodes: [{
                id: 1,
                value: "aaa",
            }],
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: false,
                minimumCount: 1,
                count: null,
                startCursor: endCursor,
                endCursor,
            },
        });

        expect(query.sql).toContain(`("value" < $1) OR ("value" = $2 AND "id" < $3)`)
        expect(query.sql).toContain(`ORDER BY "value" DESC, "id" DESC`)
        expect(args).toEqual(parsed);
        expectTypeOf(data.nodes[0] as InferPayload<typeof loader, {
            select: ["id", "value"],
            takeCursors: true,
        }>).toEqualTypeOf<{ id: number, value: string }>();
    });

    it("Cursor works with negative take", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: "id",
                value: sql.fragment`test_table_bar."value"`,
            }
        });
        const args = {
            select: ['id', 'value'] as const,
            takeCursors: true,
            cursor: "eyJ2YWx1ZSI6ImFhYSIsImlkIjoyfQ==",
            takeCount: true,
            take: -2,
            orderBy: [["value", "DESC"], ["id", "DESC"]] as const
        } as const;
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        const data = await loader.loadPagination({
            ...parsed,
            takeCursors: true,
        });
        const query = await loader.getQuery(args);
        expect(data).toEqual({
            cursors: [
                "eyJpZCI6NCwidmFsdWUiOiJiYmIifQ==",
                "eyJpZCI6MywidmFsdWUiOiJiYmIifQ==",
            ],
            nodes: [{
                id: 4,
                value: "bbb",
            }, {
                id: 3,
                value: "bbb",
            }],
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: true,
                minimumCount: 3,
                count: 9,
                startCursor: "eyJpZCI6NCwidmFsdWUiOiJiYmIifQ==",
                endCursor: "eyJpZCI6MywidmFsdWUiOiJiYmIifQ==",
            },
        });

        expect(query.sql).toContain(`(test_table_bar."value" > $1) OR (test_table_bar."value" = $2 AND "id" > $3)`)
        expect(query.sql).toContain(`ORDER BY test_table_bar."value" ASC, "id" ASC`)
        expect(args).toEqual(parsed);
        expectTypeOf(data.nodes[0] as InferPayload<typeof loader, {
            select: ["id", "value"],
        }>).toEqualTypeOf<{ id: number, value: string }>();
    });

    it("Throws an error with invalid cursors", async () => {
        const loader = makeQueryLoader({
            db,
            query: {
                select: sql.type(zodType)`SELECT *`,
                from: sql.fragment`FROM test_table_bar`,
            },
            sortableColumns: {
                id: "id",
                value: sql.fragment`"value"`,
            }
        });
        const args = {
            select: ['id', 'value'] as const,
            takeCursors: true,
            cursor: "blablabla",
            take: 1,
            orderBy: [["value", "DESC"], ["id", "DESC"]] as const
        } as const;
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        // eslint-disable-next-line
        expect(loader.loadPagination(parsed)).rejects.toThrow(/Unexpected token/);

        expect(args).toEqual(parsed);
    });

    // createGroupSelect

    it("createGroupSelector should save the type of a selected group", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const selector = createGroupSelector<typeof loader>();
        const a = selector(["id", "uid"]);

        const data = await loader.load({
            take: 1,
            select: [
                ...a.select
            ],
        });
        expectTypeOf(data[0]).toEqualTypeOf<{ id: number, uid: string }>();
        expect(data[0]).toEqual({
            id: expect.any(Number),
            uid: expect.any(String),
        });
        expectTypeOf(data[0]).toEqualTypeOf<InferPayload<typeof loader, {
            select: typeof a.select,
        }>>();
    });

    it("createGroupSelector should save the type of multiple selected group", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const selector = createGroupSelector<typeof loader>();
        const a = selector(["id", "uid"]);
        const b = selector(["value", "id"]);

        const data = await loader.load({
            take: 1,
            select: [
                ...a.select,
                ...b.select,
            ],
        });
        expectTypeOf(data[0]).toEqualTypeOf<{ id: number, uid: string, value: string }>();
        expect(data[0]).toEqual({
            id: expect.any(Number),
            uid: expect.any(String),
            value: expect.any(String),
        });
        expectTypeOf(data[0]).toEqualTypeOf<InferPayload<typeof loader, {
            select: typeof a.select | typeof b.select,
        }>>();
    });

    it("createGroupSelector works with manual selections", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const selector = createGroupSelector<typeof loader>();
        const a = selector(["id", "uid"]);

        const data = await loader.load({
            take: 1,
            select: [
                "value",
                ...a.select,
            ],
        });
        expectTypeOf(data[0]).toEqualTypeOf<{ id: number, uid: string, value: string }>();
        expect(data[0]).toEqual({
            id: expect.any(Number),
            uid: expect.any(String),
            value: expect.any(String),
        });
        expectTypeOf(data[0]).toEqualTypeOf<InferPayload<typeof loader, {
            select: typeof a.select | ["value"],
        }>>();
    });

    it("Authorization function gets called with context and returns a sql fragment", async () => {
        const spy = jest.fn();
        const loader = makeQueryLoader({
            ...genericOptions,
            constraints(ctx) {
                spy(ctx);
                if (!ctx?.userId) return sql.fragment`FALSE`;
            },
        });

        const data = await loader.load({
            take: 1,
            ctx: 3,
        });

        expect(spy).toHaveBeenCalledWith(3);
        expect(data).toEqual([]);
        const query = await loader.getQuery({
            take: 1,
            where: {
                OR: [{
                    largeIds: true,
                }, {
                    id: 3
                }]
            }
        });
        expect(query.sql).toContain("WHERE ((FALSE) AND");
    });

    it("Authorization function returns array of fragments", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            constraints(ctx) {
                return [sql.fragment`TRUE`, sql.fragment`TRUE`];
            },
        });
        const query = await loader.getQuery({
            take: 1,
        });
        expect(query.sql).toContain("WHERE ((TRUE) AND (TRUE)");
    });

    it("distinctOn can be used with sortable columns", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                value: ["test_table_bar", "value"],
                id: sql.fragment`test_table_bar."id"`,
            },
        });
        const query = await loader.getQuery({
            take: 1,
            distinctOn: ["value"],
        });
        expect(query.sql).toContain(`SELECT DISTINCT ON ("test_table_bar"."value")`);
        expect(query.sql).toContain(`ORDER BY "test_table_bar"."value" ASC`);
        const data = await loader.load({
            distinctOn: ["value"],
            orderBy: [["value", "DESC"]],
            select: ["value"],
        });
        expect(data).toEqual([{
            value: "eee",
        }, {
            value: "ddd",
        }, {
            value: "ccc",
        }, {
            value: "bbb",
        }, {
            value: "aaa",
        }]);
    });

    it("distinctOn adds orderBy fragments in front", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            query: {
                ...genericOptions.query,
                select: sql.type(zodType)`SELECT DISTINCT *`,
            },
            sortableColumns: {
                value: ["test_table_bar", "value"],
                id: sql.fragment`test_table_bar."id"`,
            },
        });
        const query = await loader.getQuery({
            take: 1,
            orderBy: [["id", "DESC"], ["value", "DESC"]],
            distinctOn: ["value"],
        });
        expect(query.sql).toContain(`SELECT DISTINCT ON ("test_table_bar"."value")`);
        expect(query.sql).toContain(`ORDER BY "test_table_bar"."value" DESC, test_table_bar."id" DESC`);
    });

    it("Allows plugins to overwrite results of load", async() => {
        const loader = makeQueryLoader({
            ...genericOptions,
            plugins: [{
                onLoad(options) {
                    if (options.args.take === 1) {
                        options.setResultAndStopExecution([{
                            ...options.args,
                        }])
                    } else if (options.args.take === 2) {
                        options.setResultAndStopExecution(Promise.resolve([{
                            ...options.args,
                        }]));
                    }
                    return {
                        onLoadDone(options) {
                            options.setResult(new Promise((resolve) => {
                                setTimeout(() => resolve([{
                                    delayed: true,
                                }]), 5);
                            }));
                        },
                    }
                },
            }],
        });

        const takeArgs = await loader.load({
            take: 1,
        });
        expect(takeArgs).toEqual([{
            take: 1,
        }]);

        expect(await loader.load({
            take: 2,
        })).toEqual([{
            take: 2,
        }])

        expect(await loader.load({
            take: 3,
        })).toEqual([{
            delayed: true,
        }]);
    });

    it("Allows plugins to overwrite results of loadPagination", async() => {
        const res = {
            nodes: [{
                a: 3,
            }],
            pageInfo: {
                count: 1,
                hasNextPage: false,
                hasPreviousPage: false,
                minimumCount: 1,
            }
        };
        const getQuerySpy = jest.fn();
        const dbSpy = jest.fn(() => Promise.resolve([] as any));
        const loader = makeQueryLoader({
            ...genericOptions,
            db: {
                any: dbSpy,
            },
            plugins: [{
                onGetQuery(options) {
                    getQuerySpy(options);
                },
                onLoadPagination(options) {
                    if (options.args.take === 1) {
                        options.setResultAndStopExecution(Promise.resolve(res));
                    }
                    if (options.args.take === 3) {
                        options.setCount(65);
                        return;
                    }
                    return {
                        onLoadDone(options) {
                            options.setResult(new Promise((resolve) => {
                                setTimeout(() => resolve({
                                    nodes: [],
                                    pageInfo: {
                                        delayed: true,
                                    } as any
                                }), 5);
                            }));
                        },
                    }
                },
            }],
        });

        const loadRes = await loader.loadPagination({
            take: 1,
            takeCount: true,
        });
        expect(loadRes).toEqual(res);
        expect(dbSpy).not.toHaveBeenCalled();
        expect(await loader.loadPagination({
            take: 2,
        })).toEqual({
            nodes: [],
            pageInfo: {
                delayed: true,
            },
        });
        // Twice for each pagination
        expect(getQuerySpy).toHaveBeenCalledTimes(3);
        expect(dbSpy).toHaveBeenCalledTimes(1);
        expect(await loader.loadPagination({
            take: 3,
        })).toEqual({
            nodes: [],
            pageInfo: expect.objectContaining({
                count: 65,
            }),
        });
        // Only one query added (no count query)
        expect(dbSpy).toHaveBeenCalledTimes(2);
    });

    it("Calls slow query plugin for slow queries", async() => {
        const spy = jest.fn();
        const loader = makeQueryLoader({
            ...genericOptions,
            sortableColumns: {
                value: ["test_table_bar", "value"],
                id: sql.fragment`test_table_bar."id"`,
            },
            plugins: [
                useSlowQueryPlugin({
                    slowQueryThreshold: 0,
                    callback: (args) => {
                        spy(args);
                    }
                })
            ],
        });

        await loader.load({
            take: 20,
            orderBy: [["id", "DESC"], ["value", "DESC"]],
        });

        expect(spy).toHaveBeenCalled();
    });
});
