import { employeeLoader } from "../../db/loaders/employeeLoader";

import { router, publicProcedure } from "../trpc";

export const employeeRouter = router({
    getPaginated: publicProcedure
        .input(employeeLoader.getLoadArgs({
            transformSortColumns(columns?) {
                return [
                    ...(columns?.filter(col => col[0] !== "id") || []),
                    // tie-breaker column when sorting
                    ["id", "ASC"]
                ]
            },
            disabledFilters: {
                OR: true,
            },
        }))
        .query(({ input, ctx }) => {
            return employeeLoader.loadPagination({
                ...input,
                ctx,
            });
        }),
});
