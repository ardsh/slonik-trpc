import { z } from 'zod';
import { sql } from 'slonik';
import { makeQueryLoader } from 'slonik-trpc';
import { mergeFilters } from 'slonik-trpc/utils';
import { db } from '../slonik';
import { prisma } from '../client'
import { companyFilters, employeeCompaniesFilters, employeeFilters } from './employeeFilters';

export const employee = z.object({
    id: z.number(),
    employee_id: z.number(),
    firstName: z.string(),
    lastName: z.string(),
    salary: z.any().transform(a => a?.toString?.()),
    company: z.string(),
    employed_days: z.union([z.number(), z.bigint()]).transform(a => a.toString()),
    startDate: z.date().transform(a => a.toISOString().slice(0,10)),
    endDate: z.date().transform(a => a.toISOString().slice(0,10)),
});
const query = sql.type(employee)`
SELECT
    employees.id,
    employees.id AS employee_id,
    employees.first_name AS "firstName",
    employees.last_name AS "lastName",
    employee_companies.salary,
    companies.name AS company,
    (end_date - start_date) / 86400 / 1000 AS employed_days,
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
    options: {
        useSqlite: true,
        runtimeCheck: true,
    },
    db: {
        any: (sql) => {
            return prisma.$queryRawUnsafe(sql.sql, ...sql.values);
        }
    },
    sortableColumns: {
        id: "employee_id",
        name: sql.fragment`"firstName" || "lastName"`,
        daysEmployed: "employed_days",
        startDate: "start_date",
        endDate: "end_date",
        salary: "salary",
        company: "name",
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
