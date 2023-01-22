import { z } from 'zod';
import { sql } from 'slonik';
import { makeQueryLoader } from 'slonik-trpc';
import { mergeFilters } from 'slonik-trpc/utils';
import { db } from '../slonik';
import { prisma } from '../client'
import { companyFilters, employeeCompaniesFilters, employeeFilters } from './employeeFilters';

export const employee = z.object({
    id: z.number(),
    firstName: z.string(),
    lastName: z.string(),
    salary: z.any().transform(a => a?.toString?.()),
    company: z.string(),
    employed_days: z.union([z.number(), z.bigint()]).transform(a => {
        if (typeof a === 'bigint') {
            // sqlite compatibility
            return Math.floor(parseInt(a.toString(), 10) / 86400 / 1000);
        }
        return a.toString();
    }),
    startDate: z.union([z.string(), z.date()]).transform(a => a instanceof Date ? a.toISOString().slice(0,10) : a),
    endDate: z.union([z.string(), z.date()]).transform(a => a instanceof Date ? a.toISOString().slice(0,10) : a),
});
const query = sql.type(employee)`
SELECT * FROM (
SELECT
    employees.id,
    employees.first_name AS "firstName",
    employees.last_name AS "lastName",
    employee_companies.salary,
    companies.name AS company,
    (end_date - start_date) AS employed_days,
    companies.id AS company_id,
    employee_companies.start_date AS "startDate",
    employee_companies.end_date AS "endDate"
FROM employees
LEFT JOIN employee_companies
    ON employees.id = employee_companies.employee_id
LEFT JOIN companies
    ON employee_companies.company_id = companies.id
) employees
`;

export type {
    InferPayload, InferArgs
} from 'slonik-trpc';
export type EmployeeLoader = typeof employeeLoader;

// SQLite compatibility for codesandbox
const sqliteCompatibility = true;

export const employeeLoader = makeQueryLoader({
    query,
    // SQLite compatibility
    ...(sqliteCompatibility ? {
        options: {
            useSqlite: true,
            runtimeCheck: true,
        },
        db: {
            any: (sql) => {
                return prisma.$queryRawUnsafe(sql.sql, ...sql.values);
            }
        },
    } : {
        db,
    }),
    sortableColumns: {
        id: "id",
        name: sql.fragment`"firstName" || "lastName"`,
        daysEmployed: "employed_days",
        startDate: "startDate",
        endDate: "endDate",
        salary: "salary",
        company: "company",
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
