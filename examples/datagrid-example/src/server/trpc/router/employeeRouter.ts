import { employeeLoader } from "../../db/loaders/employeeLoader";

import { router, publicProcedure } from "../trpc";

export const employeeRouter = router({
    getPaginated: publicProcedure
        .input(employeeLoader.getLoadArgs())
        .query(({ input, ctx }) => {
            return employeeLoader.loadPagination({
                orderBy: ["id", "ASC"],
                ...input,
                ctx,
            });
        }),
    getPrisma: publicProcedure
        .input(employeeLoader.getLoadArgs())
        .query(async ({ input, ctx}) => {
            const allEmployees = await ctx.prisma.employeeCompany.findMany({
                take: input.take,
                skip: input.skip,
                orderBy: {
                    employee: {
                        first_name: "asc",
                    },
                },
                select: {
                    employee: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                        }
                    },
                    salary: true,
                    start_date: true,
                    end_date: true,
                    // company: {
                    //     select: {
                    //         name: true,
                    //     }
                    // },
                },
            });
            return {
                edges: allEmployees.map(employee => ({
                    id: employee.employee.id,
                    fullName: employee.employee.first_name + ' ' + employee.employee.last_name,
                    company: employee.start_date,
                    salary: employee.salary,
                    startDate: employee.start_date,
                    endDate: employee.end_date,
                })),
                count: 100000,
                minimumCount: 10000,
                hasNextPage: true,
            }
        })
});
