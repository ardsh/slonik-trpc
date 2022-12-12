"use strict";(self.webpackChunkslonik_trpc_docs=self.webpackChunkslonik_trpc_docs||[]).push([[130],{3905:(e,t,r)=>{r.d(t,{Zo:()=>u,kt:()=>f});var a=r(7294);function n(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,a)}return r}function s(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){n(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function i(e,t){if(null==e)return{};var r,a,n=function(e,t){if(null==e)return{};var r,a,n={},o=Object.keys(e);for(a=0;a<o.length;a++)r=o[a],t.indexOf(r)>=0||(n[r]=e[r]);return n}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(a=0;a<o.length;a++)r=o[a],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(n[r]=e[r])}return n}var l=a.createContext({}),p=function(e){var t=a.useContext(l),r=t;return e&&(r="function"==typeof e?e(t):s(s({},t),e)),r},u=function(e){var t=p(e.components);return a.createElement(l.Provider,{value:t},e.children)},c="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},m=a.forwardRef((function(e,t){var r=e.components,n=e.mdxType,o=e.originalType,l=e.parentName,u=i(e,["components","mdxType","originalType","parentName"]),c=p(r),m=n,f=c["".concat(l,".").concat(m)]||c[m]||d[m]||o;return r?a.createElement(f,s(s({ref:t},u),{},{components:r})):a.createElement(f,s({ref:t},u))}));function f(e,t){var r=arguments,n=t&&t.mdxType;if("string"==typeof e||n){var o=r.length,s=new Array(o);s[0]=m;var i={};for(var l in t)hasOwnProperty.call(t,l)&&(i[l]=t[l]);i.originalType=e,i[c]="string"==typeof e?e:n,s[1]=i;for(var p=2;p<o;p++)s[p]=r[p];return a.createElement.apply(null,s)}return a.createElement.apply(null,r)}m.displayName="MDXCreateElement"},6527:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>l,contentTitle:()=>s,default:()=>c,frontMatter:()=>o,metadata:()=>i,toc:()=>p});var a=r(7462),n=(r(7294),r(3905));const o={sidebar_position:4},s="Usage",i={unversionedId:"usage-main-features/usage",id:"usage-main-features/usage",title:"Usage",description:"slonik-trpc allows you to create a loader for each SQL query. With this loader, you can filter, sort, and paginate your data with ease, all while leveraging the power and efficiency of SQL.",source:"@site/docs/usage-main-features/usage.md",sourceDirName:"usage-main-features",slug:"/usage-main-features/usage",permalink:"/slonik-trpc/docs/usage-main-features/usage",draft:!1,editUrl:"https://github.com/ardsh/slonik-trpc/tree/main/docs/docs/usage-main-features/usage.md",tags:[],version:"current",sidebarPosition:4,frontMatter:{sidebar_position:4},sidebar:"tutorialSidebar",previous:{title:"Setup",permalink:"/slonik-trpc/docs/usage-main-features/setup"},next:{title:"Offset-based pagination",permalink:"/slonik-trpc/docs/usage-main-features/pagination"}},l={},p=[{value:"Create a query loader",id:"create-a-query-loader",level:2}],u={toc:p};function c(e){let{components:t,...r}=e;return(0,n.kt)("wrapper",(0,a.Z)({},u,r,{components:t,mdxType:"MDXLayout"}),(0,n.kt)("h1",{id:"usage"},"Usage"),(0,n.kt)("p",null,(0,n.kt)("inlineCode",{parentName:"p"},"slonik-trpc")," allows you to create a loader for each SQL query. With this loader, you can filter, sort, and paginate your data with ease, all while leveraging the power and efficiency of SQL. "),(0,n.kt)("p",null,"You can look at the ",(0,n.kt)("a",{parentName:"p",href:"https://stackblitz.com/github/ardsh/slonik-trpc/tree/main/examples/minimal-trpc"},"minimal-example playground")," for a simple query loader, or ",(0,n.kt)("a",{parentName:"p",href:"https://stackblitz.com/github/ardsh/slonik-trpc/tree/main/examples/datagrid-example"},"other examples"),"."),(0,n.kt)("h2",{id:"create-a-query-loader"},"Create a query loader"),(0,n.kt)("p",null,"Create a file at ",(0,n.kt)("inlineCode",{parentName:"p"},"src/postsLoader.ts"),":"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-ts",metastring:'title="postsLoader.ts"',title:'"postsLoader.ts"'},"import { makeQueryLoader } from 'slonik-trpc';\nimport { sql } from 'slonik';\n\nconst postsQuery = sql.type(z.object({\n        id: z.number(),\n        author: z.string(),\n        title: z.string(),\n        date: z.string(),\n    }))`SELECT\n        posts.id,\n        users.first_name || ' ' || users.last_name AS author,\n        posts.title,\n        posts.date\n    FROM posts\n    LEFT JOIN users\n        ON users.id = posts.author_id`;\n\nexport const postsLoader = makeQueryLoader({\n    db,\n    query,\n});\n")))}c.isMDXComponent=!0}}]);