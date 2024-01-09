import {
    CommonQueryMethods,
    createPool,
    createTypeParserPreset,
    sql,
} from "slonik";

import { createResultParserInterceptor } from "slonik-trpc/utils";
import { fillRandomEmployeeData } from "./schema";

export function getPostgresUrl(): string {
    return (
        process.env.DATABASE_URL ||
        process.env.POSTGRES_DSN ||
        `postgres://${encodeURIComponent(
            process.env.PGUSER || "postgres"
        )}:${encodeURIComponent(process.env.PGPASSWORD || "password")}@${
            process.env.PGHOST || "0.0.0.0"
        }:${process.env.PGPORT || "5432"}/${
            process.env.PGDATABASE || "postgres"
        }`
    );
}

const pool = createPool(getPostgresUrl(), {
    maximumPoolSize: 1,
    idleTimeout: 40000,
    connectionTimeout: 30000,
    interceptors: [createResultParserInterceptor()],
    typeParsers: [
        ...createTypeParserPreset().filter(
            (a) => a.name !== "timestamp" && a.name !== "timestamptz"
        ),
        {
            name: "timestamptz",
            parse: (a) =>
                !a || !Date.parse(a) ? a : new Date(a).toISOString(),
        },
        {
            name: "timestamp",
            parse: (a) =>
                !a || !Date.parse(a) ? a : new Date(a + "Z").toISOString(),
        },
    ],
});

export const db: CommonQueryMethods = new Proxy({} as never, {
    get(target, prop: keyof CommonQueryMethods) {
        return (...args: any[]) => {
            return pool.then((db) => {
                return Function.prototype.apply.apply(db[prop], [db, args]);
            });
        };
    },
});

async function initializeDatabase() {
    const employeeCount = await db.any(sql.unsafe`SELECT COUNT(*) FROM employees;`)
    if (employeeCount[0].count < 100000) {
        fillRandomEmployeeData();
    }
}

initializeDatabase();
