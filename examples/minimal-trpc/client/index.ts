import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import type { PostLoader, AppRouter } from "../server";
import fetch from "cross-fetch";
import type { InferArgs, InferPayload } from "../server/router";

type RouterInput = inferRouterInputs<AppRouter>;
type RouterOutput = inferRouterOutputs<AppRouter>;

type PostsArgs = RouterInput['loadPosts'];

const client = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: "http://localhost:2022",
            fetch,
        }),
    ],
});

type ReplaceNodes<TResult, TPayload> = TResult extends { nodes?: ArrayLike<any>, hasNextPage?: boolean } ? Omit<TResult, "nodes"> & {
    nodes: TPayload[]
} : TResult extends object ? {
    [K in keyof TResult]: ReplaceNodes<TResult[K], TPayload>
} : TResult;

const getPosts = <TArgs extends InferArgs<PostLoader>>(args: TArgs) => {
    return client.loadPosts.query(args as any).then(data => data as ReplaceNodes<typeof data, InferPayload<PostLoader, TArgs>>);
}

async function main() {
    const posts = await getPosts({
        selectGroups: ["postDetails"],
        select: ["author_id"],
        orderBy: [["title", "ASC"]]
    });

    console.log(
        posts.nodes.map((post) => ({
            ...post,
            id: post.id,
            // @ts-expect-error fullName is not selected
            author_id: post.fullName,
        }))
    );

    const bobPosts = await getPosts({
        where: {
            OR: [{
                authorName: 'Bob'
            }, {
                longPost: true,
            }],
        },
        takeCount: true,
        take: 2,
    });
    console.log('Bob posts:');
    console.log(bobPosts);

    const cursorPagination = await getPosts({
        searchAfter: {
            date: '2022-05-01T15:43Z'
        },
        orderBy: ["date", "ASC"],
        take: 1,
    });
    console.log("Post after may 1st")
    console.log(cursorPagination.nodes[0]);
}

main();
