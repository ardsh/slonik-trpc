import { sql } from 'slonik';
import { z } from 'zod';

import { makeQueryTester } from '../../core/__tests__/makeQueryTester';
import { makeQueryAnalyzer } from '../queryAnalyzer';
import { makeQueryLoader } from '../../core/makeQueryLoader';

const { db } = makeQueryTester('analyzer');

it("Allows analyzing a SQL query type safely", async () => {
    const analyzer = makeQueryAnalyzer(db);
    const result = await analyzer.analyzeQuery(sql.unsafe`SELECT 3 as number`);
    expect(result).toEqual({
        execution: expect.any(Number),
        planning: expect.any(Number),
        plan: expect.anything(),
    });
});

const zodType = z.object({
    id: z.number(),
    uid: z.string(),
    value: z.string(),
});

it("Benchmarks a query loader's selectable fields", async () => {
    const analyzer = makeQueryAnalyzer(db);
    const spy = jest.spyOn(analyzer, 'analyzeQuery');
    const loader = makeQueryLoader({
        db,
        filters: {
            filters: {
                id: z.number(),
            },
            interpreters: {
                id: num => num ? sql.fragment`"id" = ${num}` : null,
            }
        },
        query: {
            select: sql.type(zodType)`SELECT *`,
            from: sql.fragment`FROM test_table_bar`,
        },
    });
    const result = await analyzer.benchmarkQueryLoaderFields(loader, {
        iterations: 100,
        args: {
            take: 200,
            where: {
                id: 42,
            }
        }
    });
    expect(result).toEqual({
        id: expect.any(Number),
        uid: expect.any(Number),
        value: expect.any(Number),
    });
    expect(spy).toHaveBeenCalledTimes(100*3);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        values: expect.arrayContaining([42]),
    }));
    await analyzer.testAllFilters(loader, {
        mappers: {
            id: () => 5,
        },
    });
});
