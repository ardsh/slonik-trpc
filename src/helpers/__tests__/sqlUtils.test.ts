import { z } from 'zod';
import { sql } from 'slonik';
import {
    rowToJson,
    rowsToArray,
    invertFilter,
    genericFilter,
    arrayFilter,
    dateFilter,
    booleanFilter,
    comparisonFilter,
    stringFilter,
    arrayifyType,
    stringFilterType,
    comparisonFilterType,
} from '../../utils';

test("Arrayify type", () => {
    const arrayString = arrayifyType(z.string());
    expect(arrayString.parse('a')).toEqual(['a']);
});

describe('Filters', () => {
    it("Invert filter", () => {
        expect(invertFilter(null)).toBeNull();
        expect(invertFilter(undefined)).toBeNull();
        expect(invertFilter(sql.fragment`test`)).toEqual(sql.fragment`NOT ( test )`);
    });
    it("Generic filter", () => {
        expect(genericFilter(null, sql.fragment`test`)).toBeNull();
        expect(genericFilter(undefined, sql.fragment`test`)).toBeNull();
        expect(genericFilter(1, sql.fragment`test`)).toEqual(sql.fragment`test`);
    });
    it("Array filter", () => {
        expect(arrayFilter(null, sql.fragment`test`)).toBeNull();
        expect(arrayFilter(undefined, sql.fragment`test`)).toBeNull();
        expect(arrayFilter([], sql.fragment`test`)).toBeNull();
        expect(arrayFilter('a', sql.fragment`test`)).toEqual(sql.fragment`test = ANY(${sql.array(['a'], 'text')})`);
        expect(arrayFilter(['a', 'b'], sql.fragment`test`)).toEqual(sql.fragment`test = ANY(${sql.array(['a', 'b'], 'text')})`);
    });
    it("Date filter", () => {
        expect(dateFilter(null, sql.fragment`test`)).toBeNull();
        expect(dateFilter(undefined, sql.fragment`test`)).toBeNull();
        expect(dateFilter({}, sql.fragment`test`)).toBeNull();
        expect(dateFilter({ _gt: '2021-01-01' }, sql.fragment`test`)).toEqual(sql.fragment`(test > ${'2021-01-01'})`);
        expect(dateFilter({ _lt: '2021-01-01' }, sql.fragment`test`)).toEqual(sql.fragment`(test < ${'2021-01-01'})`);
        expect(dateFilter({ _gte: '2021-01-01' }, sql.fragment`test`)).toEqual(sql.fragment`(test >= ${'2021-01-01'})`);
        expect(dateFilter({ _lte: '2021-01-01' }, sql.fragment`test`)).toEqual(sql.fragment`(test <= ${'2021-01-01'})`);
        expect(dateFilter({ _gt: '2021-01-01', _lt: '2021-01-02' }, sql.fragment`test`)).toEqual(sql.fragment`(test > ${'2021-01-01'}) AND (test < ${'2021-01-02'})`);
    });
    it("Boolean filter", () => {
        expect(booleanFilter(null, sql.fragment`test`)).toBeNull();
        expect(booleanFilter(undefined, sql.fragment`test`)).toBeNull();
        expect(booleanFilter(true, sql.fragment`true statement`)).toEqual(sql.fragment`true statement`);
        expect(booleanFilter(false, sql.fragment`true statement`)).toEqual(sql.fragment`NOT ( true statement )`);
    });

    it("Comparison filter", () => {
        expect(comparisonFilter(null, sql.fragment`test`)).toBeNull();
        expect(comparisonFilter(undefined, sql.fragment`test`)).toBeNull();
        expect(comparisonFilter(comparisonFilterType.parse({ _gt: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test > ${'1'})`);
        expect(comparisonFilter(comparisonFilterType.parse({ _lt: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test < ${'1'})`);
        expect(comparisonFilter(comparisonFilterType.parse({ _gte: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test >= ${'1'})`);
        expect(comparisonFilter(comparisonFilterType.parse({ _lte: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test <= ${'1'})`);
        expect(comparisonFilter(comparisonFilterType.parse({ _neq: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test != ${'1'})`);
        expect(comparisonFilter(comparisonFilterType.parse({ _eq: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test = ${'1'})`);
        expect(comparisonFilter(comparisonFilterType.parse({ _in: ['1', '2'] }), sql.fragment`test`)).toEqual(sql.fragment`(test = ANY(${sql.array(['1', '2'], 'text')}))`);
        expect(comparisonFilter(comparisonFilterType.parse({ _nin: ['1', '2'] }), sql.fragment`test`)).toEqual(sql.fragment`(NOT ( test = ANY(${sql.array(['1', '2'], 'text')}) ))`);
        expect(comparisonFilter(comparisonFilterType.parse({ _is_null: true }), sql.fragment`test`)).toEqual(sql.fragment`(test IS NULL)`);
        expect(comparisonFilter(comparisonFilterType.parse({ _is_null: false }), sql.fragment`test`)).toEqual(sql.fragment`(test IS NOT NULL)`);
    });

    it("String filter", () => {
        expect(stringFilter(null, sql.fragment`test`)).toBeNull();
        expect(stringFilter(undefined, sql.fragment`test`)).toBeNull();
        expect(stringFilter(stringFilterType.parse('textString'), sql.fragment`test`)).toEqual(sql.fragment`(test = ${'textString'})`);
        expect(stringFilter(stringFilterType.parse({ _in: ['1', '2'] }), sql.fragment`test`)?.sql).toMatch(sql.fragment`(test = ANY(${sql.array(['1', '2'], 'text')}))`.sql);
        expect(stringFilter(stringFilterType.parse({ _like: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test LIKE ${'1'})`);
        expect(stringFilter(stringFilterType.parse({ _ilike: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test ILIKE ${'1'})`);
        expect(stringFilter(stringFilterType.parse({ _nlike: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test NOT LIKE ${'1'})`);
        expect(stringFilter(stringFilterType.parse({ _nilike: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test NOT ILIKE ${'1'})`);
        expect(stringFilter(stringFilterType.parse({ _regex: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test ~ ${'1'})`);
        expect(stringFilter(stringFilterType.parse({ _iregex: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test ~* ${'1'})`);
        expect(stringFilter(stringFilterType.parse({ _nregex: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test !~ ${'1'})`);
        expect(stringFilter(stringFilterType.parse({ _niregex: '1' }), sql.fragment`test`)).toEqual(sql.fragment`(test !~* ${'1'})`);
    });
});

import { makeQueryTester } from '../../core/__tests__/makeQueryTester';

describe("Query builders", () => {
    const { db } = makeQueryTester('builders');
    it("Row to json", () => {
        expect(rowToJson(sql.fragment`test`, 'test')?.sql).toMatch(`row_to_json`);
    });
    it("Rows to array", () => {
        expect(rowsToArray(sql.fragment`test`, sql.fragment`FROM`, 'test')?.sql).toMatch('json_agg');
    });

    it("Selects rows to array", async () => {
        const result = await db.any(sql.unsafe`SELECT ${
            rowsToArray(
                sql.fragment`SELECT email, date_of_birth`,
                sql.fragment`FROM users`,
            )
        }`);
        expect(result).toEqual([{
            users: expect.arrayContaining([{
                email: expect.any(String),
                date_of_birth: expect.any(String),
            }])
        }]);
    });

    it("Selects row to object", async () => {
        const result = await db.any(sql.unsafe`SELECT ${
            rowToJson(
                sql.fragment`SELECT email, date_of_birth FROM users LIMIT 1`,
                'user'
            )
        }`);
        expect(result).toEqual([{
            user: {
                email: expect.any(String),
                date_of_birth: expect.any(String),
            }
        }]);
    });
});

import { jsonbFilter, jsonbContainsFilter } from '../sqlUtils';

describe('jsonbFilter', () => {
    it('handles simple boolean value', () => {
        const result = jsonbFilter('valid', true, ['meta']);
        expect(result?.sql).toBe(`("meta"->>'valid')::bool = $1`);
        expect(result?.values).toEqual([true]);
    });
    
    it('handles simple number value', () => {
        const result = jsonbFilter('amount', 123, ['meta']);
        expect(result?.sql).toBe(`("meta"->>'amount')::float8 = $1`);
        expect(result?.values).toEqual([123]);
    });
    
    it('handles simple string value', () => {
        const result = jsonbFilter('name', 'test', ['meta']);
        expect(result?.sql).toBe(`("meta"->>'name') = $1`);
        expect(result?.values).toEqual(['test']);
    });
    
    it('handles nested object with mixed types', () => {
        const nestedObject = {
            nested: {
                foo: '123',
                bar: 321,
                deep: {
                    baz: 59,
                    qux: false,
                },
            },
        };

        const result = jsonbFilter('meta', nestedObject);
        expect(result?.sql).toBe(`(("meta"->'nested'->>'foo') = $1 AND ("meta"->'nested'->>'bar')::float8 = $2 AND (("meta"->'nested'->'deep'->>'baz')::float8 = $3 AND ("meta"->'nested'->'deep'->>'qux')::bool = $4))`);
        expect(result?.values).toEqual(['123', 321, 59, false]);
    });

    it('handles null values', () => {
        const result = jsonbFilter('nullableField', null, ['meta']);
        expect(result?.sql).toBe(`("meta"->>'nullableField') IS NULL`);
    });

    it('Ignores null values in top-level field', () => {
        const result = jsonbFilter('nullableField', null);
        expect(result).toBeNull();
    });

    it("handles undefined value in top-level field", () => {
        const result = jsonbFilter("undefinedField", undefined, ["meta"]);
        expect(result).toBeNull();
    });

    it("Doesn't ignore null values in nested fields", () => {
        const nestedObject = {
            nested: {
                bar: 321,
                foo: null,
            },
        };

        const result = jsonbFilter("meta", nestedObject);
        expect(result?.sql).toBe(`(("meta"->'nested'->>'bar')::float8 = $1 AND ("meta"->'nested'->>'foo') IS NULL)`);
        expect(result?.values).toEqual([321]);
    });

    it("(BUG) Ignores array values in nested fields", () => {
        const nestedObject = {
            nested: {
                bar: 321,
                interests: ['sports', 'music'],
            },
        };

        const result = jsonbFilter("meta", nestedObject);
        expect(result?.sql).toBe(`("meta"->'nested'->>'bar')::float8 = $1`);
        expect(result?.values).toEqual([321]);
    });

    it("ignores undefined values in nested fields", () => {
        const nestedObject = {
            nested: {
                foo: undefined,
                bar: 321,
            },
        };

        const result = jsonbFilter("meta", nestedObject);
        expect(result?.sql).toBe(`("meta"->'nested'->>'bar')::float8 = $1`);
        expect(result?.values).toEqual([321]);
    });

    it("returns null for entirely undefined nested object", () => {
        const nestedObject = {
            nested: {
                foo: undefined,
                bar: undefined,
            },
        };

        const result = jsonbFilter("meta", nestedObject);
        expect(result).toBeNull();
    });

    it("Handles jsonb contains filter", () => {
        const result = jsonbContainsFilter({ foo: 'bar' }, sql.fragment`meta`);
        expect(result?.sql).toBe(`(meta)::jsonb @> $1::jsonb`);
        expect(result?.values).toEqual([JSON.stringify({ foo: 'bar' })]);
    })
});
