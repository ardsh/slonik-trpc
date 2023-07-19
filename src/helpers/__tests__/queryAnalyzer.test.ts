import { sql } from 'slonik';
import { z } from 'zod';

import { makeQueryTester } from '../../core/__tests__/makeQueryTester';
import { makeQueryAnalyzer, mockZod } from '../queryAnalyzer';
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
        sortableColumns: {
            id: 'id',
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
        zodMappers: {
            date: () => "2021-01-01",
        },
    });
});

describe("mockZod", () => {
    it("should generate a valid mock object for a simple Zod schema", () => {
        const schema = z.object({
            someKey: z.string(),
            someNumber: z.number().nullish(),
            someBoolean: z.boolean(),
        });

        const mockObject = mockZod(schema);

        expect(schema.safeParse(mockObject).success).toBe(true);
    });

    it("should use custom mappers when provided for specific Zod types", () => {
        const schema = z.object({
            someKey: z.string(),
            someDate: z.date(),
        });

        const mockObject = mockZod(schema, { zodMappers: {
            ZodDate: () => "2023-07-20",
        } });

        expect(mockObject.someDate).toEqual("2023-07-20");
    });

    it("should use custom mappers when provided for specific fields", () => {
        const schema = z.object({
            someKey: z.string(),
            someCustomField: z.string(),
        });

        const mappers = {
            someCustomField: () => "Custom Value",
        };

        const mockObject = mockZod(schema, { mappers });

        expect(mockObject.someCustomField).toBe("Custom Value");
    });

    it("should generate a mock object with nested objects and arrays", () => {
        const schema = z.object({
            someKey: z.string(),
            someNestedObject: z.object({
                nestedKey: z.number(),
            }),
            someArray: z.array(z.string()),
        });

        const mockObject = mockZod(schema, {
            mappers: {
                nestedKey: () => 42,
            }
        });
        const parsed = schema.safeParse(mockObject);

        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.someNestedObject.nestedKey).toEqual(42);
    });

    it('should generate a mock object with null for ZodNull', () => {
        const schema = z.object({
            someKey: z.string(),
            someNullField: z.null(),
        });

        const mockObject = mockZod(schema);

        expect(mockObject.someNullField).toBeNull();
    });

    it('should generate a mock object with undefined for ZodNever', () => {
        const schema = z.object({
            someKey: z.string(),
            someNeverField: z.never(),
        });

        const mockObject = mockZod(schema);

        expect(mockObject.someNeverField).toBeUndefined();
    });

    it('should generate a mock object with valid data for ZodLazy', () => {
        const schema = z.object({
            someKey: z.string(),
            someLazyField: z.lazy(() => z.number()),
        });

        const mockObject = mockZod(schema);

        expect(typeof mockObject.someLazyField).toBe('number');
    });

    it('should generate a mock object with enum value for ZodEnum', () => {
        const colors = ['red', 'blue', 'green'] as const;
        const schema = z.object({
            someKey: z.string().optional(),
            someEnumField: z.enum(colors),
        });

        const mockObject = mockZod(schema);

        expect(colors).toContain(mockObject.someEnumField);
    });

    it('should generate a mock object with valid data for ZodEffects', () => {
        const schema = z.object({
            someKey: z.string(),
            someEffectsField: z.string().transform(() => 'someValues'),
        });

        const mockObject = mockZod(schema);

        expect(mockObject.someEffectsField).toHaveLength(10);
    });

    it('should generate a mock object with default data for default values', () => {
        const schema = z.object({
            someKey: z.string(),
            someDefaultField: z.string().default('blabla'),
        });

        const mockObject = mockZod(schema);

        expect(mockObject.someDefaultField).toBe('blabla');
    });

    it('should generate a mock object with the first union option', () => {
        const schema = z.object({
            someKey: z.string(),
            someUnionField: z.union([z.string(), z.number(), z.boolean()]),
        });

        const mockObject = mockZod(schema);

        expect(typeof mockObject.someUnionField).toMatch(/string|number|boolean/);
    });
});
