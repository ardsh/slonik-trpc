import { router } from "../trpc";
import { employeeRouter } from "./employeeRouter";

export const appRouter = router({
    employees: employeeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
