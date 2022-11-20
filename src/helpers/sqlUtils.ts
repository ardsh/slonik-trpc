import { sql } from 'slonik';
import { Fragment } from './types';

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
