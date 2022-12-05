import { initTRPC } from "@trpc/server";
import { postsLoader } from "./loaders/getPosts";
import type { InferPayload, InferArgs } from 'slonik-trpc';

const t = initTRPC.context<Context>().create({
    errorFormatter({ shape }) {
        return shape;
    },
});

export function createContext({ req, res }: any) {
    const user = { name: req.headers["username"] ?? "anonymous" };
    return { req, res, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

export const appRouter = t.router({
    loadPosts: t.procedure
        .input(postsLoader.getLoadArgs())
        .query(({ input, ctx }) => {
            return postsLoader.loadPagination({
                ...input,
                select: input.select,
                // selectGroups: input.selectGroups,
                ctx,
            })
        }),
    greet: t.procedure
        .input((val: unknown) => {
            if (typeof val === "string") return val;
            throw new Error(`Invalid input: ${typeof val}`);
        })
        .query(({ input }) => ({ greeting: `hello, ${input}!` })),
});

export type AppRouter = typeof appRouter;

export type PostLoader = typeof postsLoader;

export type {
    InferPayload,
    InferArgs
}
