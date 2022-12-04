import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server";
import fetch from "cross-fetch";

const client = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: "http://localhost:2022",
            fetch,
        }),
    ],
});

async function main() {
    const posts = await client.loadPosts.query({
        selectGroups: ["postDetails"],
        orderBy: ["createdAt", "ASC"],
    });
    console.log(
        posts.edges.map((post) => ({
            ...post,
            id: post.id,
        }))
    );
}

main();
