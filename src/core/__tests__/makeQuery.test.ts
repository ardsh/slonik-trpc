import { makeQueryLoader } from '../makeQueryLoader';
import { sql } from 'slonik';
import { z } from 'zod';
import { makeQueryTester } from './makeQueryTester';

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
                value: z.string()
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
    })
});
