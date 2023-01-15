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
});
