"use strict";(self.webpackChunkslonik_trpc_docs=self.webpackChunkslonik_trpc_docs||[]).push([[68],{3905:(e,t,n)=>{n.d(t,{Zo:()=>c,kt:()=>h});var a=n(7294);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function s(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?s(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):s(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function o(e,t){if(null==e)return{};var n,a,r=function(e,t){if(null==e)return{};var n,a,r={},s=Object.keys(e);for(a=0;a<s.length;a++)n=s[a],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var s=Object.getOwnPropertySymbols(e);for(a=0;a<s.length;a++)n=s[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var l=a.createContext({}),p=function(e){var t=a.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},c=function(e){var t=p(e.components);return a.createElement(l.Provider,{value:t},e.children)},u="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},d=a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,s=e.originalType,l=e.parentName,c=o(e,["components","mdxType","originalType","parentName"]),u=p(n),d=r,h=u["".concat(l,".").concat(d)]||u[d]||m[d]||s;return n?a.createElement(h,i(i({ref:t},c),{},{components:n})):a.createElement(h,i({ref:t},c))}));function h(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var s=n.length,i=new Array(s);i[0]=d;var o={};for(var l in t)hasOwnProperty.call(t,l)&&(o[l]=t[l]);o.originalType=e,o[u]="string"==typeof e?e:r,i[1]=o;for(var p=2;p<s;p++)i[p]=n[p];return a.createElement.apply(null,i)}return a.createElement.apply(null,n)}d.displayName="MDXCreateElement"},6913:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>u,frontMatter:()=>s,metadata:()=>o,toc:()=>p});var a=n(7462),r=(n(7294),n(3905));const s={sidebar_position:20},i="Slonik",o={unversionedId:"usage-main-features/slonik",id:"usage-main-features/slonik",title:"Slonik",description:"This is an abbreviated guide to get started with slonik for the purposes of this tutorial, which is just a toy example.",source:"@site/docs/usage-main-features/slonik.md",sourceDirName:"usage-main-features",slug:"/usage-main-features/slonik",permalink:"/slonik-trpc/docs/usage-main-features/slonik",draft:!1,editUrl:"https://github.com/ardsh/slonik-trpc/tree/main/docs/docs/usage-main-features/slonik.md",tags:[],version:"current",sidebarPosition:20,frontMatter:{sidebar_position:20},sidebar:"tutorialSidebar",previous:{title:"Plugins",permalink:"/slonik-trpc/docs/usage-main-features/plugins"},next:{title:"Client-side patterns",permalink:"/slonik-trpc/docs/category/client-side-patterns"}},l={},p=[{value:"PostgreSQL",id:"postgresql",level:2},{value:"Connecting",id:"connecting",level:2},{value:"Creating the database schema",id:"creating-the-database-schema",level:2}],c={toc:p};function u(e){let{components:t,...n}=e;return(0,r.kt)("wrapper",(0,a.Z)({},c,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"slonik"},"Slonik"),(0,r.kt)("p",null,"This is an abbreviated guide to get started with slonik for the purposes of this tutorial, which is just a toy example."),(0,r.kt)("p",null,"You can also skip this step if you get started with the ",(0,r.kt)("a",{parentName:"p",href:"https://stackblitz.com/github/ardsh/slonik-trpc/tree/main/examples/minimal-trpc"},"minimal-example playground")),(0,r.kt)("p",null,"You should refer to ",(0,r.kt)("a",{parentName:"p",href:"https://github.com/gajus/slonik#usage"},"slonik's comprehensive documentation")," for more advanced use cases."),(0,r.kt)("h2",{id:"postgresql"},"PostgreSQL"),(0,r.kt)("p",null,"This is a good starting point for getting ",(0,r.kt)("a",{parentName:"p",href:"https://hasura.io/blog/top-postgresql-database-free-tier-solutions/"},"free PostgreSQL database in the cloud")),(0,r.kt)("p",null,"Create a database in ",(0,r.kt)("a",{parentName:"p",href:"https://neon.tech/"},"Neon"),", then export the DATABASE_URL by putting it in your .env file."),(0,r.kt)("h2",{id:"connecting"},"Connecting"),(0,r.kt)("p",null,"Install slonik"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"yarn add slonik\n")),(0,r.kt)("p",null,"Create a file at ",(0,r.kt)("inlineCode",{parentName:"p"},"src/slonik.ts"),":"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts",metastring:'title="src/slonik.ts"',title:'"src/slonik.ts"'},'import { CommonQueryMethods, createPool, createTypeParserPreset, sql } from \'slonik\';\nimport { createResultParserInterceptor } from "slonik-trpc/utils";\n\nexport const slonik = createPool(process.env.POSTGRES_DSN || process.env.DATABASE_URL, {\n    interceptors: [createResultParserInterceptor()],\n    typeParsers: [\n    ...createTypeParserPreset().filter(\n        (a) => a.name !== "timestamp" && a.name !== "timestamptz" && a.name !== "date"\n    ), {\n        name: "date",\n        parse: (a) => !a || !Date.parse(a) ? a :\n            new Date(a).toISOString().slice(0, 10),\n    }, {\n        name: "timestamptz",\n        parse: (a) => !a || !Date.parse(a) ? a : new Date(a).toISOString(),\n    }, {\n        name: "timestamp",\n        parse: (a) => !a || !Date.parse(a) ? a : new Date(a + "Z").toISOString(),\n    }],\n})\n\n// If you\'re using ES modules with node 14+ you can use top-level await here\n// export const db = await slonik;\nexport const db: CommonQueryMethods = new Proxy({} as never, {\n    get(target, prop: keyof CommonQueryMethods) {\n        return (...args: any[]) => {\n            return pool.then((db) => {\n                return Function.prototype.apply.apply(db[prop], [db, args]);\n            });\n        };\n    },\n});\n')),(0,r.kt)("p",null,"We're adding specific type parsers for the timestamp/date types to make it easier by returning ISO strings, slonik returns int timestamps by default."),(0,r.kt)("p",null,"The DATABASE_URL env variable should take the form of ",(0,r.kt)("inlineCode",{parentName:"p"},"postgresql://user:password@host:port/database")),(0,r.kt)("h2",{id:"creating-the-database-schema"},"Creating the database schema"),(0,r.kt)("p",null,"If you'd like to create the database schema for this tutorial in SQL, simply create a ",(0,r.kt)("inlineCode",{parentName:"p"},"schema.ts")," file."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts",metastring:'title="src/schema.ts"',title:'"src/schema.ts"'},"import { db } from './slonik.ts';\n\nexport async function initializeDatabase(schema?: string) {\n    if (schema) {\n        await db.query(sql.unsafe`\n            CREATE SCHEMA IF NOT EXISTS ${sql.identifier([schema])};\n            SET search_path TO ${sql.identifier([schema])};\n        `);\n    }\n    await db.query(sql.unsafe`\n        DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS posts;\n\n        CREATE TABLE IF NOT EXISTS posts (\n            id integer NOT NULL PRIMARY KEY,\n            author_id text NOT NULL,\n            title text NOT NULL,\n            date date NOT NULL,\n            content text NOT NULL DEFAULT '',\n            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n        );\n\n        CREATE TABLE IF NOT EXISTS users (\n            \"id\" text NOT NULL PRIMARY KEY,\n            \"first_name\" text NOT NULL,\n            \"last_name\" text NOT NULL,\n            \"email\" text NOT NULL,\n            \"created_at\" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n        );`);\n    await db.query(sql.unsafe`\n        INSERT INTO posts\n            (id, author_id, title, content, date)\n        VALUES\n            (1, 'z', 'aaa', 'This is a post', '2022-01-01'),\n            (2, 'y', 'aaa', 'This is a post', '2022-02-01'),\n            (3, 'x', 'bbb', 'This is a post', '2022-03-01'),\n            (4, 'w', 'bbb', 'This is a post', '2022-04-01'),\n            (5, 'v', 'ccc', 'This is a post', '2022-05-01'),\n            (6, 'u', 'ccc', 'This is a post', '2022-06-01'),\n            (7, 't', 'ddd', 'This is a post', '2022-07-01'),\n            (8, 's', 'ddd', 'This is a post', '2022-08-01'),\n            (9, 'r', 'eee', 'This is a post', '2022-09-01');\n\n        INSERT INTO users\n            (id, \"first_name\", \"last_name\", email)\n        VALUES\n            ('z', 'Haskell', 'Nguyen', 'haskell04@gmail.com'),\n            ('y', 'Padberg', 'Fletcher', 'padberg.shawna@hotmail.com'),\n            ('x', 'Neal', 'Phillips', 'nvandervort@collier.com'),\n            ('w', 'Nolan', 'Muller', 'qnolan@yahoo.com'),\n            ('v', 'Bob', 'Dean', 'acummerata@gmail.com'),\n            ('u', 'Rebecca', 'Mercer', 'moore.rebeca@yahoo.com'),\n            ('t', 'Katheryn', 'Ritter', 'katheryn89@hotmail.com'),\n            ('s', 'Dulce', 'Espinoza', 'dulce23@gmail.com'),\n            ('r', 'Paucek', 'Clayton', 'paucek.deangelo@hotmail.com');\n    `);\n}\n\ninitializeDatabase('playground');\n")))}u.isMDXComponent=!0}}]);