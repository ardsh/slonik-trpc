import { z } from 'zod';
import { sql } from 'slonik';
import { Fragment } from './types';
import { arrayifyType, notEmpty } from './zod';

export { arrayifyType };

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
    bool: boolean | undefined,
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

export const dateFilter = (
    date: z.infer<typeof dateFilterType> | undefined,
    field: Fragment
) => {
    if (Array.isArray(date)) {
        date = {
            _gt: date[0],
            _lt: date[1] || undefined,
        };
    }
    if (typeof date === 'string') {
        date = {
            _gt: date,
        };
    }
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
    filter: string[] | number[] | string | number | undefined,
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
