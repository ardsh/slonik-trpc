import { appRouter, createContext } from "./router";
import { createHTTPServer } from "@trpc/server/adapters/standalone";

export type AppRouter = typeof appRouter;

createHTTPServer({
    router: appRouter,
    createContext,
}).listen(2022);
