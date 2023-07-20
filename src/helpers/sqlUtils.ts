import { z } from 'zod';
import { sql } from 'slonik';
import { Fragment } from './types';
import { notEmpty } from './zod';

export const arrayifyType = <T extends z.ZodType>(type: T) =>
z.preprocess(
    (a) => (Array.isArray(a) ? a : [a].filter(notEmpty)),
    z.union([z.array(type), type])
);

export const rowToJson = (fragment: Fragment, name?: string) => sql.fragment`
row_to_json((SELECT row FROM (${fragment}) row)) AS ${sql.identifier([name || 'row_to_json'])}
`;

export const rowsToArray = (
    fragment: Fragment,
    fromFragment: Fragment,
    name?: string
) => sql.fragment`
( SELECT coalesce(json_agg("rows"), '[]') AS "rows" FROM (
SELECT row_to_json((
        SELECT "element" FROM (
            ${fragment}
        ) AS "element"
    )) AS "rows"
    ${fromFragment}
) all
) AS ${sql.identifier([name || 'rows_to_array'])}
`;

export const arrayStringFilterType = arrayifyType(z.string());

export const dateFilterType = z
    .object({
        _lt: z.string(),
        _gt: z.string(),
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

export const dateFilter = (
    date: z.infer<typeof dateFilterType> | undefined | null,
    field: Fragment
) => {
    const conditions = [] as Fragment[];
    if (date?._gt) {
        conditions.push(sql.fragment`${field} > ${date._gt}`);
    }
    if (date?._lt) {
        conditions.push(sql.fragment`${field} < ${date._lt}`);
    }
    if (conditions.length) {
        return sql.fragment`(${sql.join(conditions, sql.fragment`) AND (`)})`;
    }
    return null;
};

export const arrayFilter = (
    filter: string[] | number[] | string | number | undefined | null,
    field: Fragment,
    type = 'text'
) => {
    if (!Array.isArray(filter)) filter = [filter].filter(notEmpty) as string[];
    if (filter?.length) {
        return sql.fragment`${field} = ANY(${sql.array(filter, type)})`;
    }
    return null;
};

export const invertFilter = (condition?: Fragment | null) => {
    if (condition) {
        return sql.fragment`NOT ( ${condition} )`;
    }
    return null;
};

export const comparisonFilterType = z.object({
    _gt: z.string().optional(),
    _lt: z.string().optional(),
    _eq: z.string().optional(),
    _neq: z.string().optional(),
    _in: arrayStringFilterType.optional(),
    _nin: arrayStringFilterType.optional(),
    _is_null: z.boolean().optional(),
});

export const comparisonFilter = (
    filter: z.infer<typeof comparisonFilterType> | undefined | null,
    field: Fragment,
    type = 'text'
) => {
    const conditions = [] as Fragment[];
    if (filter?._gt) {
        conditions.push(sql.fragment`${field} > ${filter._gt}`);
    }
    if (filter?._lt) {
        conditions.push(sql.fragment`${field} < ${filter._lt}`);
    }
    if (filter?._eq) {
        conditions.push(sql.fragment`${field} = ${filter._eq}`);
    }
    if (filter?._neq) {
        conditions.push(sql.fragment`${field} != ${filter._neq}`);
    }
    if (filter?._in?.length) {
        const fragment = arrayFilter(filter._in, field, type);
        if (fragment) {
            conditions.push(fragment);
        }
    }
    if (filter?._nin?.length) {
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
export const stringFilterType = comparisonFilterType.extend({
    _ilike: z.string().optional(),
    _like: z.string().optional(),
    _nlike: z.string().optional(),
    _nilike: z.string().optional(),
    _regex: z.string().optional(),
    _iregex: z.string().optional(),
    _nregex: z.string().optional(),
    _niregex: z.string().optional(),
});

export const stringFilter = (
    filter: z.infer<typeof stringFilterType> | undefined | null,
    field: Fragment
) => {
    const conditions = [] as Fragment[];
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
