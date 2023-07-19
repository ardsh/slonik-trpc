"use strict";(self.webpackChunkslonik_trpc_docs=self.webpackChunkslonik_trpc_docs||[]).push([[343],{3905:(e,t,r)=>{r.d(t,{Zo:()=>l,kt:()=>m});var n=r(7294);function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function a(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function s(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?a(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):a(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function i(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},a=Object.keys(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}var u=n.createContext({}),p=function(e){var t=n.useContext(u),r=t;return e&&(r="function"==typeof e?e(t):s(s({},t),e)),r},l=function(e){var t=p(e.components);return n.createElement(u.Provider,{value:t},e.children)},c="mdxType",g={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},f=n.forwardRef((function(e,t){var r=e.components,o=e.mdxType,a=e.originalType,u=e.parentName,l=i(e,["components","mdxType","originalType","parentName"]),c=p(r),f=o,m=c["".concat(u,".").concat(f)]||c[f]||g[f]||a;return r?n.createElement(m,s(s({ref:t},l),{},{components:r})):n.createElement(m,s({ref:t},l))}));function m(e,t){var r=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var a=r.length,s=new Array(a);s[0]=f;var i={};for(var u in t)hasOwnProperty.call(t,u)&&(i[u]=t[u]);i.originalType=e,i[c]="string"==typeof e?e:o,s[1]=i;for(var p=2;p<a;p++)s[p]=r[p];return n.createElement.apply(null,s)}return n.createElement.apply(null,r)}f.displayName="MDXCreateElement"},8128:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>u,contentTitle:()=>s,default:()=>c,frontMatter:()=>a,metadata:()=>i,toc:()=>p});var n=r(7462),o=(r(7294),r(3905));const a={sidebar_position:17},s="Aggregating",i={unversionedId:"usage-main-features/grouping",id:"usage-main-features/grouping",title:"Aggregating",description:"To group your data, you can use the groupBy fragment option of the query. This allows you to specify the GROUP BY fragment that will be applied to your query:",source:"@site/docs/usage-main-features/grouping.md",sourceDirName:"usage-main-features",slug:"/usage-main-features/grouping",permalink:"/slonik-trpc/docs/usage-main-features/grouping",draft:!1,editUrl:"https://github.com/ardsh/slonik-trpc/tree/main/docs/docs/usage-main-features/grouping.md",tags:[],version:"current",sidebarPosition:17,frontMatter:{sidebar_position:17},sidebar:"tutorialSidebar",previous:{title:"Cursor-based pagination",permalink:"/slonik-trpc/docs/usage-main-features/cursor-pagination"},next:{title:"Plugins",permalink:"/slonik-trpc/docs/usage-main-features/plugins"}},u={},p=[],l={toc:p};function c(e){let{components:t,...r}=e;return(0,o.kt)("wrapper",(0,n.Z)({},l,r,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"aggregating"},"Aggregating"),(0,o.kt)("p",null,"To group your data, you can use the ",(0,o.kt)("inlineCode",{parentName:"p"},"groupBy")," fragment option of the query. This allows you to specify the ",(0,o.kt)("inlineCode",{parentName:"p"},"GROUP BY")," fragment that will be applied to your query:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},"const postsLoader = makeQueryLoader({\n    db,\n    query: {\n        select: sql.type(z.object({\n            author: z.string(),\n            count: z.number(),\n        }))`SELECT\n            users.first_name || ' ' || users.last_name AS author,\n            COUNT(*) AS \"postsCount\"`,\n        from: sql.fragment`FROM posts\n        LEFT JOIN users\n            ON users.id = posts.author_id`,\n        groupBy: sql.fragment`users.id`,\n    },\n    filters: postsFilter,\n});\n")),(0,o.kt)("p",null,"Now this can be used to get the posts count of each user. Additionally, you can reuse all the normal posts filter from the other posts loader."),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},"// Get post counts of non-gmail users\nconst groupedByName = await postsLoader.load({\n    where: {\n        isGmail: false,\n    }\n}));\n")))}c.isMDXComponent=!0}}]);