import { sql, SqlFragment } from 'slonik';
import { z } from 'zod';
import { createFilters, arrayStringFilterType, arrayFilter, dateFilter, dateFilterType } from 'slonik-trpc/utils';
import { Context } from '../../trpc/context';
``
export const nameFilter = (filter: string[] | string | undefined, firstNameField: SqlFragment, lastNameField: SqlFragment) => {
    if (!Array.isArray(filter)) filter = [filter].filter(Boolean) as any[];
    if (filter?.length) {
        const tokens = filter
            .flatMap((searchText) => searchText.split(/\W+/))
            .filter(token => token?.length > 2);
        if (tokens.length === 2 || tokens.length === 3) {
            // If just 2 or 3 tokens, try all fullName combinations
            const combinations = tokens.flatMap((el, i) => tokens.filter((t, j) => j !== i).map(o => [el, o]));
            const conditions = combinations.map(([firstName, lastName]) => sql.fragment`${firstNameField} ILIKE ${'%' + firstName + '%'} AND ${lastNameField} ILIKE ${'%' + lastName + '%'}`);
            return sql.fragment`(${sql.join(conditions, sql.fragment`) OR (`)})`;
        }
        const conditions = tokens.map(
            (token) => sql.fragment`(${firstNameField} || ${lastNameField} ILIKE ${'%' + token + '%'})`
        );
        if (conditions.length) {
            return sql.fragment`(${sql.join(conditions, sql.fragment`) OR (`)})`;
        }
    }
    return null;
};
export const employeeFilters = createFilters<Context>()({
    employeeId: arrayStringFilterType,
    employeeName: arrayStringFilterType,
}, {
    employeeId: (value) => arrayFilter(value, sql.fragment`employees.id`),
    // Custom SQL filter that tries to fuzzy match with ILIKE
    employeeName: value => nameFilter(value, sql.fragment`employees.first_name`, sql.fragment`employees.last_name`),
}, {
    postprocess(conditions, filters, context) {
        // Usually you can add something like this, to disable querying companies a user doesn't have permission to.
        // conditions.push(sql.fragment`companies.id=ANY(${sql.array(context.userInfo.companies)})`)
        if (!context.userInfo.id) {
            // Disable filtering entirely if unauthorized...
            conditions.push(sql.fragment`FALSE`);
        }
        return conditions;
    },
});

export const companyFilters = createFilters<Context>()({
    companyId: arrayStringFilterType,
}, {
    companyId: value => arrayFilter(value, sql.fragment`companies.id`),
});

export const employeeCompaniesFilters = createFilters<Context>()({
    employmentStartDate: dateFilterType,
    employmentEndDate: dateFilterType,
    employmentSalary: z.object({
        _gt: z.number(),
        _lt: z.number(),
    }).partial(),
}, {
    employmentSalary: value => dateFilter(value as any, sql.fragment`employee_companies.salary`),
    employmentStartDate: value => dateFilter(value, sql.fragment`employee_companies.start_date`),
    employmentEndDate: value => dateFilter(value, sql.fragment`employee_companies.end_date`),
});
