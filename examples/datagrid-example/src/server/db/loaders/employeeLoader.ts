import { z } from 'zod';
import { sql } from 'slonik';
import { makeQueryLoader } from 'slonik-trpc';
import { mergeFilters } from 'slonik-trpc/utils';
import { db } from '../slonik';
import { companyFilters, employeeCompaniesFilters, employeeFilters } from './employeeFilters';

export const employee = z.object({
    id: z.number(),
    firstName: z.string(),
    lastName: z.string(),
    salary: z.number(),
    company: z.string(),
    startDate: z.string(),
    endDate: z.string(),
});
const query = sql.type(employee)`
SELECT
    employees.id,
    employees.first_name AS "firstName",
    employees.last_name AS "lastName",
    employee_companies.salary,
    companies.name AS company,
    employee_companies.start_date AS "startDate",
    employee_companies.end_date AS "endDate"
FROM employees
LEFT JOIN employee_companies
    ON employees.id = employee_companies.employee_id
LEFT JOIN companies
    ON employee_companies.company_id = companies.id
`;

export type {
    InferPayload, InferArgs
} from 'slonik-trpc';
export type EmployeeLoader = typeof employeeLoader;

export const employeeLoader = makeQueryLoader({
    query,
    db,
    sortableColumns: {
        id: sql.fragment`employees.id`,
        name: sql.fragment`employees.first_name || employees.last_name`,
        startDate: ["employee_companies", "start_date"],
        endDate: ["employee_companies", "end_date"],
        salary: "salary",
        company: ["companies", "name"],
    },
    filters: mergeFilters([employeeFilters, employeeCompaniesFilters, companyFilters]),
    virtualFields: {
        fullName: {
            dependencies: ["firstName", "lastName"],
            resolve(row) {
                return row.firstName + ' ' + row.lastName;
            },
        },
    }
});
