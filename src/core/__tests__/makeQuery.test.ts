import { makeQueryLoader, InferPayload, InferArgs } from '../makeQueryLoader';
import { sql } from 'slonik';
import { z } from 'zod';
import { makeQueryTester } from './makeQueryTester';

import { createFilters, makeFilter } from '../queryFilter';
import { createGroupSelector } from '../selectGroups';
import { arrayFilter, booleanFilter, dateFilter, dateFilterType, arrayifyType } from '../../helpers/sqlUtils';
import { expectTypeOf } from 'expect-type';
import { createOptions } from '../../index';

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
        });
        const result = await loader.load({});
        expect(result[0].id).toEqual(expect.any(Number));
        expect(result).not.toHaveLength(0);
        expectTypeOf(result[0]).toEqualTypeOf<{ id: number, uid: string, value: string }>();
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
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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

    it("Passes the context as a 2nd parameter in virtual field resolvers", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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

    it("Allows selecting fields", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.fragment`SELECT * FROM test_table_bar`,
            type: zodType,
        });
        const query = await loader.loadPagination({
            select: ['value'],
            skip: 1,
            take: 1
        });
        expectTypeOf(query.edges[0]).toEqualTypeOf<{ value: string }>();
        expect(loader.getSelectableFields()).not.toContain("someOtherField")
        expectTypeOf(loader.getSelectableFields()[0]).toEqualTypeOf<["id", "uid", "value"][number]>()
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
        expect(loaded).toEqual(query.edges);
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
            query: sql.type(z.any())`SELECT * FROM test_table_bar`,
        });
        const take = 1;
        const query = await loader.loadPagination({
            takeCount: true,
            take
        });
        expect(query.edges).toEqual([{
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
            query: sql.type(z.any())`SELECT * FROM test_table_bar`,
        });
        const take = 1;
        const query = await loader.getQuery({
            takeCursors: true,
            take,
            orderBy: ["id", "ASC"],
        });
        expect(query.sql).toContain("cursorcolumns");
        expect(query.sql.toUpperCase()).not.toContain("LATERAL");
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
        expect(query.pageInfo.minimumCount).toEqual(query.edges.length + 1);
        expect(query.pageInfo.count).toBeNull();
        const keys = Object.keys(query.edges[0]);
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
        expect(query.pageInfo.minimumCount).toEqual(query.edges.length + take*(takeNextPages-1) +1);
        expect(query.pageInfo.count).toBeDefined();
        expect(query.edges[1].value).toEqual(expect.any(String));
        expectTypeOf(query.edges[0]).toEqualTypeOf<{ value: string }>();
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
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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
        expect(() => loader.getQuery({
            orderBy: [["id", "ASC"]] as any,
        })).toThrow(/Invalid enum value/);
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
        const selectable = loader.getQuery({
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
            }),
            filters: {
                ...genericOptions.filters,
                options: {
                    postprocess(conditions, filters, context) {
                        expectTypeOf(context).toEqualTypeOf<{ userId: string }>();
                        expect(context).toEqual({ userId: "bla" });
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
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
        });
        const query = loader.getQuery({
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
            takeCount: true,
            take: 1,
            orderBy: [["value", "DESC"], ["id", "DESC"]] as const
        } as const;
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        const data = await loader.loadPagination(parsed);
        const query = loader.getQuery(args);
        expect(data).toEqual({
            edges: [{
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
        expectTypeOf(data.edges[0] as InferPayload<typeof loader, {
            select: ["id", "value"],
        }>).toEqualTypeOf<{ id: number, value: string }>();
    });

    it("Loads cursor-based even when sorted by complex expression column", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT id, uid, value FROM test_table_bar`,
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
            take: 1,
            orderBy: [["upperValue", "DESC"], ["id", "DESC"]] as const
        };
        const query = loader.getQuery(args);
        expect(query.sql).toContain(`(UPPER("value") < $1) OR (UPPER("value") = $2 AND "id" < $3)`)
        expect(query.sql).toContain(`ORDER BY UPPER("value") DESC, "id" DESC`)
        const data = await loader.loadPagination(args);
        expectTypeOf(data.edges[0]).toEqualTypeOf<{ id: number, value: string }>();
        expect(data).toEqual({
            edges: [{
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
        expectTypeOf(data.edges[0]).toEqualTypeOf<InferPayload<typeof loader, {
            select: ["id", "value"],
        }>>();
    });

    it("Reverses the order when take parameter is negative, while returning items in the original order", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
            sortableColumns: {
                id: "id",
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
            orderBy: [["upperValue", "DESC"], ["id", "DESC"]] as const
        };
        const query = loader.getQuery(args);
        expect(query.sql).toContain(`(UPPER(test_table_bar."value") > $1) OR (UPPER(test_table_bar."value") = $2 AND "id" > $3)`)
        expect(query.sql).toContain(`ORDER BY UPPER(test_table_bar."value") ASC, "id" ASC`)
        const data = await loader.loadPagination(args);
        expect(data).toEqual({
            edges: [{
                id: 4,
                value: "bbb",
            }, {
                id: 3,
                value: "bbb"
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
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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
        const data = await loader.loadPagination(args);
        const query = loader.getQuery(args);
        expect(data).toEqual({
            edges: [{
                id: 3,
                value: "bbb"
            }],
            pageInfo: {
                hasPreviousPage: true,
                hasNextPage: true,
                minimumCount: 2,
                count: null,
            },
        });
        expect(query.sql).toContain(`("id" > $1) OR ("id" = $2 AND "value" IS NULL)`)
        expect(query.sql).toContain(`ORDER BY "id" ASC, "value" ASC`)
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        expect(args).toEqual(parsed);
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
            takeCount: true,
            orderBy: [["id", "ASC"], ["value", "ASC"]] as const
        };
        const parser = loader.getLoadArgs();
        const parsed = parser.parse(args);
        const query = loader.getQuery(parsed);
        expect(query.sql).toContain(`("id" IS NULL) OR (TRUE AND "value" > $1)`)
        expect(query.sql).toContain(`ORDER BY "id" ASC, "value" ASC`)
        expectTypeOf(parsed.where).toEqualTypeOf<undefined>();
        const data = await loader.loadPagination(args);
        expect(data).toEqual({
            edges: [{
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
        expectTypeOf(data.edges[0]).toEqualTypeOf<InferPayload<typeof loader, {
            select: ["id", "value"],
        }>>();
        expect(args).toEqual(parsed);
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
        const data = await loader.load({
            take: 1,
            // @ts-expect-error nonSelectable group selected
            selectGroups: ["nonSelectable"]
        });
        // expectTypeOf(data[0]).toMatchTypeOf<{ id: number, uid: string, dummyField: any, value: string }>();
        expect(data[0]).toEqual({
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
        expect(query.edges).toEqual(query.edges.map(i => ({
            value: expect.any(String),
        })));
        expect(query.cursors).toBeDefined();
        expectTypeOf(query.cursors).toEqualTypeOf<(string | null)[] | undefined>();
    });

    it("Returns items after cursor", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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
        const query = loader.getQuery(args);
        const endCursor = data.pageInfo.endCursor;
        expect(data).toEqual({
            cursors: ["eyJ2YWx1ZSI6ImFhYSIsImlkIjoxfQ=="],
            edges: [{
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
        expectTypeOf(data.edges[0] as InferPayload<typeof loader, {
            select: ["id", "value"],
            takeCursors: true,
        }>).toEqualTypeOf<{ id: number, value: string }>();
    });

    it("Can access internal columns for determining the cursor", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT test_table_bar.id, test_table_bar.uid, test_table_bar.value FROM test_table_bar`,
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
        const query = loader.getQuery(args);
        const endCursor = data.pageInfo.endCursor;
        expect(data).toEqual({
            cursors: ["eyJ2YWx1ZSI6ImFhYSIsImlkIjoxfQ=="],
            edges: [{
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
        expectTypeOf(data.edges[0] as InferPayload<typeof loader, {
            select: ["id", "value"],
            takeCursors: true,
        }>).toEqualTypeOf<{ id: number, value: string }>();
    });

    it("Cursor works with negative take", async () => {
        const loader = makeQueryLoader({
            db,
            query: sql.type(zodType)`SELECT * FROM test_table_bar`,
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
        const query = loader.getQuery(args);
        expect(data).toEqual({
            cursors: [
                "eyJ2YWx1ZSI6ImJiYiIsImlkIjo0fQ==",
                "eyJ2YWx1ZSI6ImJiYiIsImlkIjozfQ==",
            ],
            edges: [{
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
                startCursor: "eyJ2YWx1ZSI6ImJiYiIsImlkIjo0fQ==",
                endCursor: "eyJ2YWx1ZSI6ImJiYiIsImlkIjozfQ==",
            },
        });

        expect(query.sql).toContain(`(test_table_bar."value" > $1) OR (test_table_bar."value" = $2 AND "id" > $3)`)
        expect(query.sql).toContain(`ORDER BY test_table_bar."value" ASC, "id" ASC`)
        expect(args).toEqual(parsed);
        expectTypeOf(data.edges[0] as InferPayload<typeof loader, {
            select: ["id", "value"],
        }>).toEqualTypeOf<{ id: number, value: string }>();
    });

    it("Throws an error with invalid cursors", async () => {
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
});
