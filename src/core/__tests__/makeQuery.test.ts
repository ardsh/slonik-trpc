import { makeQueryLoader } from '../makeQueryLoader';
import { sql } from 'slonik';
import { z } from 'zod';
import { makeQueryTester } from './makeQueryTester';

import { createFilters, makeFilter } from '../queryFilter';
import { arrayFilter, booleanFilter, dateFilter, dateFilterType, arrayifyType } from '../../helpers/sqlUtils';
import { expectTypeOf } from 'expect-type';

type ReturnFirstArgument<T> = T extends (...args: readonly [(infer A)]) => any ? <G extends A=A>(...args: readonly [G]) => G : T;
const createOptions: ReturnFirstArgument<typeof makeQueryLoader> = ((options) => {
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
        const loader = makeQueryLoader({
            db,
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
        expectTypeOf(result[0]).toEqualTypeOf<{ id: number, uid: string, value: string, someOtherField: string }>();
    });

    it("Works with sql query type", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
        });
        const result = await loader.load({});
        expect(result[0].id).toEqual(expect.any(Number));
        expectTypeOf(result[0]).toEqualTypeOf<{ id: number, uid: string, value: string }>();
        expect(result).not.toHaveLength(0);
    });

    it("Returns correct query", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
        });
        const query = loader.getQuery({
            select: ['id'],
        });

        expect(query.sql).toMatch("id");
        expect(query.sql).not.toMatch("value");
        expect(query.parser._def.toString()).toEqual(zodType._def.toString());
    });

    it("Returns virtual fields", async () => {
        const loader = makeQueryLoader({
            db,
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
            take: 1
        });
        expect(query[0]?.ids).toEqual(expect.any(String));
        expect(loader.getSelectableFields()).toContain("ids");
        expectTypeOf(loader.getSelectableFields()[0]).toEqualTypeOf<"ids" | "id" | "uid" | "value">();
    });

    it("Returns virtual fields by default if none are selected/excluded", async () => {
        const loader = makeQueryLoader({
            db,
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
            take: 1
        });
        expect(query[0]?.ids).toEqual(expect.any(String));
        expect(loader.getSelectableFields()).toContain("ids");
        expectTypeOf(query[0]).toEqualTypeOf<{ id: number, ids: string, uid: string, value: string }>()
    });

    it("Doesn't return virtual fields by default if some others are selected", async () => {
        const resolve = jest.fn((row) => row.id + row.uid);
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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

    it("Allows returning promises from virtual fields", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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
        expect(query.edges[0]).toEqual(expect.objectContaining({
            ids: expect.any(String),
            field: expect.any(Number),
        }));
        expect(query.edges[0]?.ids).toEqual(expect.any(String));
        expect(query.edges[0]?.field).toEqual(expect.any(Number));
        expect(loader.getSelectableFields()).toContain("ids");
        expectTypeOf(query.edges[0]).toHaveProperty("ids");
        expectTypeOf(query.edges[0]).toEqualTypeOf<{ ids: string, field: number }>();
    });

    it("Allows post-processing results", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.fragment`SELECT * FROM test_table_bar`,
            type: zodType,
            postprocess(data) {
                return {
                    ...data,
                    someOtherField: 'blabla',
                }
            }
        });
        const query = await loader.loadPagination({
            select: ['value'],
            skip: 1,
            take: 1
        });
        expect(query.edges[0]?.someOtherField).toEqual('blabla');
        expectTypeOf(query.edges[0]).toEqualTypeOf<{ value: string, someOtherField: string }>();
        expect(loader.getSelectableFields()).not.toContain("someOtherField")
        expectTypeOf(loader.getSelectableFields()[0]).toEqualTypeOf<["id", "uid", "value"][number]>()
    });

    it("Allows post-processing results as a promise", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.fragment`SELECT * FROM test_table_bar`,
            type: zodType,
            async postprocess(data) {
                const result = await new Promise<string>(res => res('blabla'));
                return {
                    ...data,
                    someOtherField: result,
                }
            }
        });
        const query = await loader.load({
            select: ['value'],
            take: 1
        });
        expect(query[0]?.someOtherField).toEqual('blabla');
        expectTypeOf(query[0]).toEqualTypeOf<{ value: string, someOtherField: string }>();
        expect(loader.getSelectableFields()).not.toContain("someOtherField")
        expectTypeOf(loader.getSelectableFields()[0]).toEqualTypeOf<["id", "uid", "value"][number]>()
    });

    it("Throws errors that occur during post-processing", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.fragment`SELECT * FROM test_table_bar`,
            type: zodType,
            async postprocess(data) {
                const result = await new Promise<string>((res, rej) => rej('Error fetching!'));
                return {
                    ...data,
                    someOtherField: result,
                }
            }
        });

        // eslint-disable-next-line jest/valid-expect
        expect(loader.load({
            select: ['value'],
            take: 1
        })).rejects.toEqual("Error fetching!");
    });

    it("Throws errors that occur in virtual fields", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.fragment`SELECT * FROM test_table_bar`,
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

        // eslint-disable-next-line jest/valid-expect
        expect(loader.load({
            select: ['value', 'ids'],
            take: 1
        })).rejects.toEqual("Error fetching!");
    });

    it("Allows ordering by specified columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: {
                value: ["test_table_bar", "value"],
            },
        });
        expect(() => loader.getQuery({
            // @ts-expect-error id is not sortable
            orderBy: ["id", "ASC"],
        })).toThrow();
        expect(loader.getQuery({
            orderBy: ["value", "DESC"],
        }).sql).toContain(`"value" DESC`)
    });

    it("Allows ordering by multiple columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: {
                value: ["test_table_bar", "value"],
                id: "id",
            },
        });
        expect(loader.getQuery({
            orderBy: [["id", "ASC"], ["value", "DESC"]],
        }).sql).toContain(`"id" ASC, "test_table_bar"."value" DESC`);
        expect(loader.getQuery({
            orderBy: ["value", "DESC"],
        }).sql).toContain(`"value" DESC`)
        expect(await loader.load({
            orderBy: [["value", "DESC"], ["id", "ASC"]],
        })).toMatchSnapshot();
    });

    it("Allows using sql fragment for specifying sortable columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: {
                value: sql.fragment`COALESCE("uid", "value")`,
                id: "id",
            },
        });
        expect(loader.getQuery({
            orderBy: [["id", "ASC"], ["value", "DESC"]],
        }).sql).toContain(`"id" ASC, COALESCE("uid", "value") DESC`);
        expect(loader.getQuery({
            orderBy: ["value", "DESC"],
        }).sql).toContain(`COALESCE("uid", "value") DESC`)
        expect(await loader.load({
            orderBy: [["value", "DESC"], ["id", "ASC"]],
        })).toMatchSnapshot();
    });

    it("Allows sorting by non-selectable columns", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT id, uid, value FROM test_table_bar`,
            sortableColumns: {
                date: "date"
            },
        });
        expect(() => loader.getQuery({
            // @ts-expect-error value is not sortable
            orderBy: ["value", "ASC"]
        })).toThrow();
        expect(loader.getQuery({
            orderBy: ["date", "DESC"],
        }).sql).toContain(`"date" DESC`);
        expect(await loader.load({
            orderBy: ["date", "DESC"],
        })).toEqual(expect.arrayContaining([]));
    });

    it("Doesn't allow invalid sort direction", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT id, uid FROM test_table_bar`,
            sortableColumns: {
                date: "date"
            },
        });
        expect(() => loader.getQuery({
            // @ts-expect-error blabla is not a valid sort direction
            orderBy: ["date", "blabla"]
        })).toThrow(/Invalid enum value./);
    });

    it("Allows defining filters", async () => {
        const loader = makeQueryLoader({
            db,
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
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const result = await loader.load({});
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0].uid).toEqual(expect.any(String));
        expect(result[0].value).toEqual(expect.any(String));
        expectTypeOf(result[0]).toMatchTypeOf<{ uid: string, id: number, postprocessedField: boolean, value: string, dummyField: any }>();
    });

    it("Doesn't work well if select is conditional with empty array (needs as any assertion to select all) (BUG)", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const someCondition = true;
        const result = await loader.load({
            select: someCondition ? [] : ["id"] as any,
            exclude: ["dummyField"],
        });
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0].value).toEqual(expect.any(String));
        expectTypeOf(result[0]).toEqualTypeOf<{ id: number, postprocessedField: boolean, value: string, uid: string }>();
    });
    it("Doesn't work well with exclude as conditional (needs as any assertion) (BUG)", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const someCondition = true;
        const result = await loader.load({
            exclude: someCondition ? [] : ["id"] as any,
            select: ["id", "value"]
        });
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0].value).toEqual(expect.any(String));
        expectTypeOf(result[0]).toEqualTypeOf<{ id: number, postprocessedField: boolean, value: string }>();
    });

    it("Selects required fields even if excluded", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            required: ["id"],
            defaultExcludedColumns: ["id", "dummyField"],
            sortableColumns: {
                id: "id"
            },
        });
        const result = await loader.load({
            select: ["value"],
            orderBy: ["id", "ASC"],
            exclude: ["id"]
        });
        expectTypeOf(result[0]).toEqualTypeOf<{ id: number, postprocessedField: boolean, value: string }>();
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result[0].value).toEqual(expect.any(String));
    });

    it("Selects dependent fields even if excluded", async () => {
        const loader = makeQueryLoader({
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
        // No need to add dependent fields to type, even if they're actually present.
        expectTypeOf(result[0]).toMatchTypeOf<{ id: number, postprocessedField: boolean, dummyField: any }>();
        expect(result[0].dummyField).toEqual(expect.any(String));
        // No need to have the type in this case
        // @ts-expect-error uid is excluded
        expect((result[0]).uid).toEqual(expect.any(String));
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
        expect(query.minimumCount).toEqual(expect.any(Number));
        expect(query.count).toBeNull();
        const loaded = await loader.load({
            select: ['value'],
            take: 5,
        });
        expect(loaded).toEqual(query.edges);
    });

    it("Returns total count if specified", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
        });
        const take = 5;
        const query = await loader.loadPagination({
            select: ['value'],
            takeCount: true,
            take
        });
        expect(query.count).toEqual(expect.any(Number));
        expect(query.minimumCount).toEqual(take + 1);
        expect(query.edges[0].postprocessedField).toBeDefined();
    });

    it("Returns minimal count as skip + edges.length + 1 normally", async () => {
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
        expect(query.minimumCount).toEqual(query.edges.length + 1);
        expect(query.count).toBeNull();
        const keys = Object.keys(query.edges[0]);
        expect(keys).toEqual(expect.arrayContaining(["id", "value", "postprocessedField"]));
        expect(keys).toHaveLength(3);
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
            takeNextPages,
        });
        expect(query.minimumCount).toEqual(query.edges.length + take*(takeNextPages-1) +1);
        expect(query.count).toBeNull();
        expect(query.edges[1].value).toEqual(expect.any(String));
        expectTypeOf(query.edges[0]).toEqualTypeOf<{ value: string, postprocessedField: boolean, id: number }>();
        expect(query.hasNextPage).toEqual(true);
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
        expectTypeOf(parsed.exclude?.[0]).toEqualTypeOf<"id" | "value" | "asdf" | undefined>();
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
        });
        expect(parsed).toEqual({
            orderBy: [["id", "ASC"]],
        });
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
                expectTypeOf(columns).toEqualTypeOf<["value" | "id", "ASC" | "DESC" | "ASC" | "DESC"][] | null | undefined>();
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
        const selectable = loader.getQuery({
            // @ts-expect-error value is not selectable
            select: ["id", "value", "uid"]
        });
        expect(selectable.sql).not.toContain("value");
        expect(selectable.sql).toContain("uid");
    });

    it("Required fields take precedence even if non-selectable", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            required: ["value", "uid"],
            defaultExcludedColumns: ["id", "dummyField"],
            // @ts-expect-error blabla is not a valid field
            selectableColumns: ["id", "dummyField", "blabla"],
        });
        const selectable = loader.getQuery({});
        expect(selectable.sql).toContain("value");
        expect(selectable.sql).toContain("uid");
        const data = await loader.load({
        });
        // Excludes default excluded types from the select types.
        expectTypeOf(data[0]).toEqualTypeOf<{ uid: string, value: string, postprocessedField: boolean }>();
        expect(Object.keys(data[0])).toEqual(expect.arrayContaining([
            "uid", "value", "postprocessedField"
        ]));
    });

    // defaultExcludedColumns
    it("Allows specifying the default excluded columns", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            defaultExcludedColumns: ["dummyField"]
        });
        const data = await loader.load({
            take: 1,
        });
        // @ts-expect-error dummyField is excluded by default
        expect((data[0]).dummyField).toBeUndefined();
        expectTypeOf(data[0]).toEqualTypeOf<{ id: number, uid: string, value: string, postprocessedField: boolean }>();

        const selected = await loader.load({
            take: 1,
            select: ["dummyField"]
        }).then(a => a[0]);
        expectTypeOf(selected).toMatchTypeOf<{ id: number, postprocessedField: boolean, dummyField: any }>();
        // Selected fields have precedence over default excluded
        expect(selected.dummyField).toEqual(expect.any(String));
    });

    it("Excludes virtual fields if specified on default excluded", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            defaultExcludedColumns: ["dummyField", "value"],
        });
        const data = await loader.load({
            take: 1,
        });
        expect(Object.keys(data[0])).toEqual(["id", "uid", "postprocessedField"]);
    });

    it("Default excluded columns can still be selected explicitly", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            defaultExcludedColumns: ["uid"]
        });
        const data = await loader.load({
            take: 1,
            select: ["uid"]
        }).then(a => a[0]);
        expect(data.uid).toEqual(expect.any(String));
        expectTypeOf(data).toEqualTypeOf<{ uid: string, postprocessedField: boolean, id: number }>();
    });

    it("Allows specifying context parser", async () => {
        const loader = makeQueryLoader({
            ...genericOptions,
            contextParser: z.object({
                userId: z.string(),
            }),
            filters: {
                ...genericOptions.filters,
                options: {
                    postprocess(conditions, filters, context) {
                        expectTypeOf(context).toEqualTypeOf<{ userId: string }>();
                        return conditions;
                    },
                }
            }
        });
        const data = await loader.load({
            take: 1,
            select: ["uid"],
            context: {
                userId: "bla",
                // @ts-expect-error extra field
                extraField: "disallowed without passthrough",
            }
        }).then(a => a[0]);
        expect(data.uid).toEqual(expect.any(String));
        expectTypeOf(data).toEqualTypeOf<{ uid: string, postprocessedField: boolean, id: number }>();
    });

    it("Query parser is type-safe by default", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
        });
        const query = loader.getQuery({
            select: ['id'],
            take: 1,
        });

        const data = await db.any(query);
        expectTypeOf(data[0]).toEqualTypeOf<{ id: number }>();
        expect(data).toEqual([{ id: expect.any(Number) }]);
    });

    it("Loads by cursor-based pagination when sorted by a single column", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: {
                id: "id",
            }
        });
        const data = await loader.load({
            select: ['id'],
            searchAfter: {
                id: 5
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
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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
            take: 1,
            orderBy: [["value", "DESC"], ["id", "DESC"]] as const
        };
        const data = await loader.loadPagination(args);
        const query = loader.getQuery(args);
        expect(data).toEqual({
            edges: [{
                id: 1,
                value: "aaa",
            }],
            hasNextPage: false,
            minimumCount: 1,
            count: null,
        });
        expect(query.sql).toContain(`("value" < $1) OR ("value" = $2 AND "id" < $3)`)
        expect(query.sql).toContain(`ORDER BY "value" DESC, "id" DESC`)
    });

    it("Loads cursor-based even when sorted by complex expression column", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: {
                id: "id",
                upperValue: sql.fragment`UPPER("value")`,
            }
        });
        const args = {
            select: ['id', 'value'] as const,
            searchAfter: {
                id: 2,
                upperValue: "AAA",
            },
            take: 1,
            orderBy: [["upperValue", "DESC"], ["id", "DESC"]] as const
        };
        const query = loader.getQuery(args);
        expect(query.sql).toContain(`(UPPER("value") < $1) OR (UPPER("value") = $2 AND "id" < $3)`)
        expect(query.sql).toContain(`ORDER BY UPPER("value") DESC, "id" DESC`)
        const data = await loader.loadPagination(args);
        expect(data).toEqual({
            edges: [{
                id: 1,
                value: "aaa",
            }],
            hasNextPage: false,
            minimumCount: 1,
            count: null,
        });
    });

    it("Reverses the order when take parameter is negative", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: {
                id: "id",
                upperValue: sql.fragment`UPPER("value")`,
            }
        });
        const args = {
            select: ['id', 'value'] as const,
            searchAfter: {
                id: 2,
                upperValue: "AAA",
            },
            take: -2,
            orderBy: [["upperValue", "DESC"], ["id", "DESC"]] as const
        };
        const query = loader.getQuery(args);
        expect(query.sql).toContain(`(UPPER("value") > $1) OR (UPPER("value") = $2 AND "id" > $3)`)
        expect(query.sql).toContain(`ORDER BY UPPER("value") ASC, "id" ASC`)
        const data = await loader.loadPagination(args);
        expect(data).toEqual({
            edges: [{
                id: 3,
                value: "bbb",
            }, {
                id: 4,
                value: "bbb"
            }],
            hasNextPage: true,
            minimumCount: 3,
            count: null,
        });
    });

    it("Cursor-based pagination doesn't work properly if searchAfter values aren't specified (NOT A BUG) (UNSPECIFIED BEHAVIOR, MAY CHANGE)", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: {
                id: "id",
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
        const data = await loader.loadPagination(args as any);
        const query = loader.getQuery(args as any);
        expect(data).toEqual({
            edges: [{
                id: 3,
                value: "bbb"
            }],
            hasNextPage: true,
            minimumCount: 2,
            count: null,
        });
        expect(query.sql).toContain(`("id" > $1) OR ("id" = $2 AND "value" IS NULL)`)
        expect(query.sql).toContain(`ORDER BY "id" ASC, "value" ASC`)
    });

    it("Cursor-based pagination doesn't work properly if searchAfter values aren't specified for primary column (NOT A BUG) (UNSPECIFIED BEHAVIOR, MAY CHANGE)", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: {
                id: "id",
                value: sql.fragment`"value"`,
            }
        });
        const args = {
            select: ['id', 'value'] as const,
            searchAfter: {
                value: "bbb",
            },
            take: 1,
            orderBy: [["id", "ASC"], ["value", "ASC"]] as const
        };
        const query = loader.getQuery(args as any);
        expect(query.sql).toContain(`("id" IS NULL) OR (TRUE AND "value" > $1)`)
        expect(query.sql).toContain(`ORDER BY "id" ASC, "value" ASC`)
        const data = await loader.loadPagination(args as any);
        expect(data).toEqual({
            edges: [{
                id: 5,
                value: "ccc"
            }],
            hasNextPage: true,
            minimumCount: 2,
            count: null,
        });
    });
});
