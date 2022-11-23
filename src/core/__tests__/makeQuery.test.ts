import { makeQueryLoader } from '../makeQueryLoader';
import { sql } from 'slonik';
import { z } from 'zod';
import { makeQueryTester } from './makeQueryTester';

import { createFilters, makeFilter } from '../queryFilter';
import { arrayFilter, booleanFilter, dateFilter, dateFilterType, arrayifyType } from '../../helpers/sqlUtils';

type ReturnSecondArgument<T> = T extends (...args: readonly [any, (infer A)]) => any ? <G extends A=A>(...args: readonly [G]) => G : T;
const createOptions: ReturnSecondArgument<typeof makeQueryLoader> = ((options) => {
    return options;
});

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
        const loader = makeQueryLoader(db, {
            query: sql.fragment`SELECT * FROM test_table_bar`,
            type: z.object({
                id: z.number(),
                uid: z.string(),
                value: z.string(),
            }),
            postprocess(data) {
                return {
                    ...data,
                    someOtherField: 'blabla'
                }
            },
        });
        const result = await loader.load({});
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0].someOtherField).toEqual('blabla');
        expect(result).not.toHaveLength(0);
    });

    it("Works with sql query type", async () => {
        const loader = makeQueryLoader(db, {
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
        });
        const result = await loader.load({});
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result).not.toHaveLength(0);
    });

    it("Returns correct query", async () => {
        const loader = makeQueryLoader(db, {
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
        });
        const query = loader.getQuery({
            select: ['id'],
        });

        expect(query.sql).toMatch("id");
        expect(query.sql).not.toMatch("value");
    });

    it("Returns virtual fields", async () => {
        const loader = makeQueryLoader(db, {
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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
            limit: 1
        });
        expect(query[0]?.ids).toEqual(expect.any(String));
        expect(loader.getSelectableFields()).toContain("ids");
    });

    it("Allows post-processing results", async () => {
        const loader = makeQueryLoader(db, {
            query: sql.fragment`SELECT * FROM test_table_bar`,
            type: zodType,
            postprocess(data) {
                return {
                    ...data,
                    someOtherField: 'blabla',
                }
            }
        });
        const query = await loader.load({
            select: ['value'],
            limit: 1
        });
        expect(query[0]?.someOtherField).toEqual('blabla');
        expect(loader.getSelectableFields()).not.toContain("someOtherField")

    });

    it("Allows ordering by specified columns", async () => {
        const loader = makeQueryLoader(db, {
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: ["value"]
        });
        expect(() => loader.getQuery({
            orderBy: ["id" as any, "ASC"]
        })).toThrow();
        expect(loader.getQuery({
            orderBy: ["value", "DESC NULLS LAST"],
        }).sql).toContain(`"value" DESC NULLS LAST`)
    });

    it("Allows defining filters", async () => {
        const loader = makeQueryLoader(db, {
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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
        const query = await loader.getQuery({
            limit: 1,
            where: {
                largeIds: true,
            }
        });
        const result = await loader.load({
            select: ['value', 'id'],
            limit: 1,
            where: {
                id: 8,
                largeIds: true,
            }
        });
        expect(result[0].id).toEqual(8);
    });
    const genericOptions = createOptions({
        query: sql.type(zodType)`SELECT * FROM test_table_bar`,
        required: ["id"],
        filters: {
            filters: {
                largeIds: z.boolean(),
                id: z.number(),
            },
            interpreters: {
                largeIds: (filter) => filter ? sql.fragment`"id" > 5` : sql.fragment``,
                id: num => num ? sql.fragment`"id" = ${num}` : sql.fragment``,
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
        postprocess(data) {
            return {
                ...data,
                postprocessedField: true,
            }
        }
    } as const);

    it("Selects all fields if select is unspecified", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
        });
        const result = await loader.load({});
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0].uid).toEqual(expect.any(String));
        expect(result[0].value).toEqual(expect.any(String));
    });

    it("Selects required fields even if excluded", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
            required: ["id"],
        });
        const result = await loader.load({
            select: ["value"],
            exclude: ["id"]
        });
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0].value).toEqual(expect.any(String));
    });

    it("Selects dependent fields even if excluded", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
            required: ["id"],
        });
        const result = await loader.load({
            select: ["dummyField"],
            // Dummyfield is dependent on uid
            exclude: ["id", "uid"]
        });
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0]).toEqual(expect.objectContaining({
            id: expect.any(Number),
            uid: expect.any(String),
            dummyField: expect.any(String),
        }));
        expect(result[0].dummyField).toEqual(expect.any(String));
        // No need to have the type in this case
        expect((result[0] as any).uid).toEqual(expect.any(String));
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
    const filters = [] as [string, Filter][];

    const testFilters = (filter: Filter) => {
        const loader = makeQueryLoader(db, {
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
            id: "3" as any,
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
        const loader = makeQueryLoader(db, {
            ...genericOptions,
        });
        const query = await loader.loadOffsetPagination({
            select: ['value'],
            limit: 5
        });
        expect(query.minimumCount).toEqual(expect.any(Number));
        expect(query.count).toBeNull();
        const loaded = await loader.load({
            select: ['value'],
            limit: 5,
        });
        expect(loaded).toEqual(query.edges);
    });

    it("Returns total count if specified", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
        });
        const limit = 5;
        const query = await loader.loadOffsetPagination({
            select: ['value'],
            takeCount: true,
            limit
        });
        expect(query.count).toEqual(expect.any(Number));
        expect(query.minimumCount).toEqual(limit + 1);
        expect(query.edges[0].postprocessedField).toBeDefined();
    });

    it("Returns minimal count as skip + edges.length + 1 normally", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
        });
        const query = await loader.loadOffsetPagination({
            select: ['value'],
            limit: 5
        });
        expect(query.minimumCount).toEqual(query.edges.length + 1);
        expect(query.count).toBeNull();
        const keys = Object.keys(query.edges[0]);
        expect(keys).toEqual(expect.arrayContaining(["id", "value", "postprocessedField"]));
        expect(keys).toHaveLength(3);
    });

    it("Returns minimal count based on next N pages if specified", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
        });
        const limit = 3;
        const takeNextPages = 2;
        const query = await loader.loadOffsetPagination({
            select: ['value'],
            limit,
            takeNextPages,
        });
        expect(query.minimumCount).toEqual(query.edges.length + limit*(takeNextPages-1) +1);
        expect(query.count).toBeNull();
        expect(query.edges[1].value).toEqual(expect.any(String));
        expect(query.hasNextPage).toEqual(true);
        expect(query.hasPreviousPage).toEqual(false);
    });

    // getLoadArgs

    it("Doesn't allow filtering by unknown columns", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
        });
        const parser = loader.getLoadArgs({
            sortableColumns: ["id"],
        });
        const where = {
            largeIds: true,
            someOtherField: null,
        }
        expect(parser.parse({
            where,
        })).toEqual({
            where: {
                largeIds: true,
            }
        });
    });

    it("Doesn't allow invalid types", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
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
        const loader = makeQueryLoader(db, {
            ...genericOptions,
        });
        const parser = loader.getLoadArgs({
            sortableColumns: ["value"],
        });
        expect(() => parser.parse({
            orderBy: ["id", "ASC"],
        })).toThrowErrorMatchingSnapshot();
    });

    it("Allows sorting by valid columns", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
        });
        const parser = loader.getLoadArgs({
            sortableColumns: ["id"],
        });
        expect(parser.parse({
            orderBy: ["id", "ASC"],
        })).toEqual({
            orderBy: ["id", "ASC"],
        });
    });

    it("Doesn't allow sorting with invalid directions", async () => {
        const loader = makeQueryLoader(db, {
            ...genericOptions,
        });
        const parser = loader.getLoadArgs({
            sortableColumns: ["id"],
        });
        expect(() => parser.parse({
            orderBy: ["id", "; DELETE * FROM users"],
        })).toThrowErrorMatchingSnapshot();
    });
});
