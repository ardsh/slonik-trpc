import { appRouter, createContext } from "./router";
import { createHTTPServer } from "@trpc/server/adapters/standalone";

export type {
    AppRouter,
    PostLoader,
    InferPayload,
    InferArgs,
} from './router';

createHTTPServer({
    router: appRouter,
    createContext,
}).listen(2022);
