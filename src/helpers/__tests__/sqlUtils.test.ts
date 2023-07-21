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

describe("Query builders", () => {
    it("Row to json", () => {
        expect(rowToJson(sql.fragment`test`, 'test')?.sql).toMatch(`row_to_json`);
    });
    it("Rows to array", () => {
        expect(rowsToArray(sql.fragment`test`, sql.fragment`FROM`, 'test')?.sql).toMatch('json_agg');
    });
});
