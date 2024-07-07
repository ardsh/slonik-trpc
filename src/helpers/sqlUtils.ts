import { z } from 'zod';
import { sql } from 'slonik';
import { SerializableValue, Fragment } from './types';
import { notEmpty } from './zod';

export const arrayifyType = <T extends z.ZodType>(type: T) =>
z.preprocess(
    (a) => (Array.isArray(a) ? a : [a].filter(notEmpty)),
    z.union([z.array(type), type])
);

export const rowToJson = (fragment: Fragment, name?: string) => sql.fragment`
row_to_json((SELECT row FROM (${fragment}) row)) AS ${sql.identifier([name || 'row_to_json'])}
`;

interface RowsToArray {
    (fragment: Fragment, name?: string): Fragment;
    (fragment: Fragment, fromFragment: Fragment, name?: string): Fragment;
}

export const rowsToArray: RowsToArray = (
    fragment: Fragment,
    fromFragment?: Fragment | string,
    name?: string
) => {
    const isString = typeof fromFragment === 'string';
    return sql.fragment`(
  SELECT COALESCE(json_agg(all_rows), '[]') FROM (${fragment} ${isString || !fromFragment ? sql.fragment`` : fromFragment}) AS all_rows
) AS ${sql.identifier([name || (isString ? fromFragment : findTableName(fromFragment)) || 'rows_to_array'])}`
    };

export const arrayStringFilterType = arrayifyType(z.string());

export const dateFilterType = z
    .object({
        _lt: z.string(),
        _gt: z.string(),
        _lte: z.string(),
        _gte: z.string(),
        _is_null: z.boolean(),
    })
    .partial();

export const booleanFilter = (
    bool: boolean | undefined | null,
    trueStatement: Fragment,
    // If null, doesn't add anything on a false condition
    falseStatement?: Fragment | null
) => {
    if (bool === true) {
        return trueStatement;
    } else if (bool === false && falseStatement !== null) {
        return falseStatement || invertFilter(trueStatement);
    }
    return null;
};

export const genericFilter = (
    value: any,
    statement: Fragment,
) => {
    if (value !== null && value !== undefined) {
        return statement;
    }
    return null;
};

const findTableName = (fragment?: Fragment) => {
    const table = fragment?.sql.match(/^\s*FROM\s+(\S+)/i)?.[1];
    return table?.replace(/\W+/g, '')?.toLowerCase();
};
  
export const dateFilter = (
    date: z.infer<typeof dateFilterType> | undefined | null,
    field: Fragment
) => {
    return comparisonFilter(date, field);
};

export const arrayDynamicFilter = (type = 'text') => (
    filter: string[] | number[] | string | number | undefined | null,
    field: Fragment,
    typeOverride?: string
) => {
    if (!Array.isArray(filter)) filter = [filter].filter(notEmpty) as string[];
    if (filter?.length) {
        return sql.fragment`${field} = ANY(${sql.array(filter, typeOverride || type)})`;
    }
    return null;
};

export const arrayFilter = arrayDynamicFilter();

export const invertFilter = (condition?: Fragment | null) => {
    if (condition) {
        return sql.fragment`NOT ( ${condition} )`;
    }
    return null;
};

const numberString = z.union([z.number(), z.string()]);
export const comparisonFilterType = z.object({
    _gt: numberString.optional(),
    _lt: numberString.optional(),
    _gte: numberString.optional(),
    _lte: numberString.optional(),
    _eq: numberString.optional(),
    _neq: numberString.optional(),
    _in: z.union([arrayifyType(z.number()), arrayStringFilterType]).optional(),
    _nin: z.union([arrayifyType(z.number()), arrayStringFilterType]).optional(),
    _is_null: z.boolean().optional(),
});

export const comparisonFilter = (
    filter: z.infer<typeof comparisonFilterType> | undefined | null,
    field: Fragment,
    type = 'text'
) => {
    const conditions = [] as Fragment[];
    if (filter?._gt !== undefined && filter?._gt !== null) {
        conditions.push(sql.fragment`${field} > ${filter._gt}`);
    }
    if (filter?._lt !== undefined && filter?._lt !== null) {
        conditions.push(sql.fragment`${field} < ${filter._lt}`);
    }
    if (filter?._gte !== undefined && filter?._gte !== null) {
        conditions.push(sql.fragment`${field} >= ${filter._gte}`);
    }
    if (filter?._lte !== undefined && filter?._lte !== null) {
        conditions.push(sql.fragment`${field} <= ${filter._lte}`);
    }
    if (filter?._eq !== undefined && filter?._eq !== null) {
        conditions.push(sql.fragment`${field} = ${filter._eq}`);
    }
    if (filter?._neq !== undefined && filter?._neq !== null) {
        conditions.push(sql.fragment`${field} != ${filter._neq}`);
    }
    if (typeof filter?._in !== 'number' && filter?._in?.length) {
        const fragment = arrayFilter(filter._in, field, type);
        if (fragment) {
            conditions.push(fragment);
        }
    }
    if (typeof filter?._nin !== 'number' && filter?._nin?.length) {
        const fragment = invertFilter(arrayFilter(filter._nin, field, type));
        if (fragment) {
            conditions.push(fragment);
        }
    }
    const isNull = filter?._is_null || filter?._eq === null;
    const isNotNull = filter?._is_null === false || filter?._neq === null;
    if (isNull || isNotNull) {
        conditions.push(isNull ? sql.fragment`${field} IS NULL` : sql.fragment`${field} IS NOT NULL`);
    }
    if (conditions.length) {
        return sql.fragment`(${sql.join(conditions, sql.fragment`) AND (`)})`;
    }
    return null;
};

/**
 * Use this for string comparisons with LIKE, ILIKE, etc.
*/
export const stringFilterType = z.union([z.string(), z.object({
    _gt: z.string().optional(),
    _lt: z.string().optional(),
    _eq: z.string().optional(),
    _neq: z.string().optional(),
    _in: arrayStringFilterType.optional(),
    _nin: arrayStringFilterType.optional(),
    _is_null: z.boolean().optional(),
    _ilike: z.string().optional(),
    _like: z.string().optional(),
    _nlike: z.string().optional(),
    _nilike: z.string().optional(),
    _regex: z.string().optional(),
    _iregex: z.string().optional(),
    _nregex: z.string().optional(),
    _niregex: z.string().optional(),
})]);

export const stringFilter = (
    filter: z.infer<typeof stringFilterType> | undefined | null,
    field: Fragment
) => {
    const conditions = [] as Fragment[];
    if (typeof filter === 'string') {
        return sql.fragment`(${field} = ${filter})`;
    }
    if (filter?._ilike) {
        conditions.push(sql.fragment`${field} ILIKE ${filter._ilike}`);
    }
    if (filter?._like) {
        conditions.push(sql.fragment`${field} LIKE ${filter._like}`);
    }
    if (filter?._nlike) {
        conditions.push(sql.fragment`${field} NOT LIKE ${filter._nlike}`);
    }
    if (filter?._nilike) {
        conditions.push(sql.fragment`${field} NOT ILIKE ${filter._nilike}`);
    }
    if (filter?._regex) {
        conditions.push(sql.fragment`${field} ~ ${filter._regex}`);
    }
    if (filter?._iregex) {
        conditions.push(sql.fragment`${field} ~* ${filter._iregex}`);
    }
    if (filter?._nregex) {
        conditions.push(sql.fragment`${field} !~ ${filter._nregex}`);
    }
    if (filter?._niregex) {
        conditions.push(sql.fragment`${field} !~* ${filter._niregex}`);
    }
    const fragment = comparisonFilter(filter, field);
    if (fragment) {
        conditions.push(fragment);
    }
    if (conditions.length) {
        return sql.fragment`(${sql.join(conditions, sql.fragment`) AND (`)})`;
    }
    return null;
};

export const jsonbFilter = (field: string, value: any, parentPath: string[] = []): Fragment | null => {
    const fullPath = [...parentPath, field];

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Handle nested objects recursively
        const conditions = Object.entries(value).map(([key, val]) => jsonbFilter(key, val, fullPath)).filter(notEmpty);
        if (conditions.length === 0) return null;
        if (conditions.length === 1) return conditions[0];
        return sql.fragment`(${sql.join(conditions, sql.fragment` AND `)})`;
    } else {
        // Handle primitive values with appropriate casting
        const pathExpr = sql.join(fullPath.flatMap((el, idx) => {
            if (idx === 0) {
                return [sql.identifier([el])];
            } else if (idx === fullPath.length - 1) {
                return [sql.fragment`->>`, sql.literalValue(el)];
            } else {
                return [sql.fragment`->`, sql.literalValue(el)] as any[];
            }
        }, ''), sql.fragment``);
  
        if (typeof value === 'number') {
            return sql.fragment`(${pathExpr})::float8 = ${value}`;
        } else if (typeof value === 'boolean') {
            return sql.fragment`(${pathExpr})::bool = ${value}`;
        } else if (value !== undefined && typeof value !== 'object') {
            // For other types like string, no casting is necessary
            return sql.fragment`(${pathExpr}) = ${value}`;
        } else if (value === null && fullPath.length > 1) {
            // Only handles null values for nested objects
            return sql.fragment`(${pathExpr}) IS NULL`;
        }
        return null;
    }
}

export const jsonbContainsFilter = (
    filter: Record<string, SerializableValue> | undefined | null,
    field: Fragment
) => {
    if (filter) {
        return sql.fragment`(${field})::jsonb @> ${sql.jsonb(filter)}`;
    }
    return null;
}
