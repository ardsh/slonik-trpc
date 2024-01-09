import { sql, SqlFragment } from 'slonik';

export const nameFilter = (filter: string[] | string | undefined, firstNameField: SqlFragment, lastNameField: SqlFragment) => {
    if (!Array.isArray(filter)) filter = [filter].filter(Boolean) as any[];
    if (filter?.length) {
        const tokens = filter
            .flatMap((searchText) => searchText.split(/\W+/))
            .filter(token => token?.length > 2);
        if (tokens.length === 2 || tokens.length === 3) {
            // If just 2 or 3 tokens, try all fullName combinations
            const combinations = tokens.flatMap((el, i) => tokens.filter((t, j) => j !== i).map(o => [el, o]));
            const conditions = combinations.map(([firstName, lastName]) => sql.fragment`UPPER(${firstNameField}) LIKE ${'%' + firstName?.toUpperCase() + '%'} AND UPPER(${lastNameField}) LIKE ${'%' + lastName?.toUpperCase() + '%'}`);
            return sql.fragment`(${sql.join(conditions, sql.fragment`) OR (`)})`;
        }
        const conditions = tokens.map(
            (token) => sql.fragment`(UPPER(${firstNameField} || ${lastNameField}) LIKE ${'%' + token.toUpperCase() + '%'})`
        );
        if (conditions.length) {
            return sql.fragment`(${sql.join(conditions, sql.fragment`) OR (`)})`;
        }
    }
    return null;
};
