"use strict";(self.webpackChunkslonik_trpc_docs=self.webpackChunkslonik_trpc_docs||[]).push([[608],{3905:(e,t,n)=>{n.d(t,{Zo:()=>u,kt:()=>m});var r=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function l(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var o=r.createContext({}),p=function(e){var t=r.useContext(o),n=t;return e&&(n="function"==typeof e?e(t):l(l({},t),e)),n},u=function(e){var t=p(e.components);return r.createElement(o.Provider,{value:t},e.children)},c="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},f=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,i=e.originalType,o=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),c=p(n),f=a,m=c["".concat(o,".").concat(f)]||c[f]||d[f]||i;return n?r.createElement(m,l(l({ref:t},u),{},{components:n})):r.createElement(m,l({ref:t},u))}));function m(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var i=n.length,l=new Array(i);l[0]=f;var s={};for(var o in t)hasOwnProperty.call(t,o)&&(s[o]=t[o]);s.originalType=e,s[c]="string"==typeof e?e:a,l[1]=s;for(var p=2;p<i;p++)l[p]=n[p];return r.createElement.apply(null,l)}return r.createElement.apply(null,n)}f.displayName="MDXCreateElement"},9350:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>o,contentTitle:()=>l,default:()=>c,frontMatter:()=>i,metadata:()=>s,toc:()=>p});var r=n(7462),a=(n(7294),n(3905));const i={sidebar_position:4},l="PostgreSQL Utils",s={unversionedId:"utility-extra/sql-utils",id:"utility-extra/sql-utils",title:"PostgreSQL Utils",description:"There are a few generic sql query util functions you can use to make query writing easier.",source:"@site/docs/utility-extra/sql-utils.md",sourceDirName:"utility-extra",slug:"/utility-extra/sql-utils",permalink:"/slonik-trpc/docs/utility-extra/sql-utils",draft:!1,editUrl:"https://github.com/ardsh/slonik-trpc/tree/main/docs/docs/utility-extra/sql-utils.md",tags:[],version:"current",sidebarPosition:4,frontMatter:{sidebar_position:4},sidebar:"tutorialSidebar",previous:{title:"Extra Utilities",permalink:"/slonik-trpc/docs/category/extra-utilities"},next:{title:"Query loader performance analyzer",permalink:"/slonik-trpc/docs/utility-extra/benchmark-utils"}},o={},p=[{value:"Objects and arrays",id:"objects-and-arrays",level:2},{value:"Filter utils",id:"filter-utils",level:2},{value:"Boolean Filter",id:"boolean-filter",level:3},{value:"Date Filter",id:"date-filter",level:3},{value:"Multiple string filter",id:"multiple-string-filter",level:3},{value:"Comparison filter",id:"comparison-filter",level:3}],u={toc:p};function c(e){let{components:t,...n}=e;return(0,a.kt)("wrapper",(0,r.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"postgresql-utils"},"PostgreSQL Utils"),(0,a.kt)("p",null,"There are a few generic sql query util functions you can use to make query writing easier."),(0,a.kt)("h2",{id:"objects-and-arrays"},"Objects and arrays"),(0,a.kt)("p",null,"If you want some fields to be json arrays or objects, use rowToJson and rowsToArray when writing your query"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"import { rowToJson, rowsToArray } from 'slonik-trpc/utils';\n\nconst query = sql.type(z.object({\n    id: z.string(),\n    name: z.string(),\n    email: z.string(),\n    contactInfo: z.object({\n        phoneNumber: z.string(),\n        zip: z.string(),\n        address: z.string(),\n    }),\n    posts: z.array(z.object({\n        text: z.string(),\n        title: z.string(),\n    })),\n}))`SELECT\n    users.id,\n    name,\n    email,\n    ${rowToJson(sql.fragment`\n        SELECT \"phoneNumber\", \"zip\", \"address\"\n        WHERE contact_info.id IS NOT NULL\n    `, 'contactInfo')}\n    ${rowsToArray(sql.fragment`\n        SELECT text, title`, sql.fragment`\n        FROM posts\n        WHERE posts.author = users.id`,\n        'posts'\n    )}\nFROM users\nLEFT JOIN contact_info\nON contact_info.id = users.contact_info`;\n")),(0,a.kt)("p",null,"rowsToArray takes two SQL fragments, one for selecting the fields, and the other for the FROM part. Behind the scenes, these are joined using the ",(0,a.kt)("inlineCode",{parentName:"p"},"row_to_json")," and ",(0,a.kt)("inlineCode",{parentName:"p"},"json_agg")," postgres functions."),(0,a.kt)("h2",{id:"filter-utils"},"Filter utils"),(0,a.kt)("h3",{id:"boolean-filter"},"Boolean Filter"),(0,a.kt)("p",null,"This filter accepts true/false, and isn't applied for null values."),(0,a.kt)("p",null,"When the value is ",(0,a.kt)("inlineCode",{parentName:"p"},"true"),", the condition is applied. If it's ",(0,a.kt)("inlineCode",{parentName:"p"},"false"),", the inverse of the condition is applied by default, but that can be specified."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"createFilter<Context>()({\n    largsPosts: z.boolean().nullish(),\n}, {\n    largePosts: (value) => booleanFilter(value, sql.fragment`LEN(posts.text) >= 500`)\n});\n")),(0,a.kt)("p",null,"Can be used with"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"where: {\n    largePosts: false\n}\n")),(0,a.kt)("p",null,"This returns only posts with less than 500 characters in text."),(0,a.kt)("h3",{id:"date-filter"},"Date Filter"),(0,a.kt)("p",null,"Use the ",(0,a.kt)("inlineCode",{parentName:"p"},"dateFilterType"),", which allows for comparisons with _gt and _lt."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"createFilter<Context>()({\n    postsDate: dateFilterType,\n}, {\n    postsDate: (dateValue) => dateFilter(dateValue, sql.fragment`posts.date`)\n});\n")),(0,a.kt)("h3",{id:"multiple-string-filter"},"Multiple string filter"),(0,a.kt)("p",null,"Use the ",(0,a.kt)("inlineCode",{parentName:"p"},"arrayStringFilterType"),"."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"createFilter<Context>()({\n    ids: arrayStringFilterType,\n}, {\n    ids: (values) => arrayFilter(values, sql.fragment`users.id`)\n});\n")),(0,a.kt)("h3",{id:"comparison-filter"},"Comparison filter"),(0,a.kt)("p",null,"The general comparison filter allows filtering a field with many options."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"createFilter<Context>()({\n    postTitle: comparisonFilterType,\n}, {\n    postTitle: (values) => comparisonFilter(values, sql.fragment`posts.title`)\n});\n")),(0,a.kt)("p",null,"This allows using ",(0,a.kt)("inlineCode",{parentName:"p"},"_eq"),", ",(0,a.kt)("inlineCode",{parentName:"p"},"_gt"),", ",(0,a.kt)("inlineCode",{parentName:"p"},"_lt"),", ",(0,a.kt)("inlineCode",{parentName:"p"},"_in")," and ",(0,a.kt)("inlineCode",{parentName:"p"},"_nin")," for filtering, as well as ",(0,a.kt)("inlineCode",{parentName:"p"},"_is_null"),"."),(0,a.kt)("p",null,"E.g."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},'where: {\n    postTitle: {\n        _in: ["A", "B", "C"],\n        _is_null: false,\n    }\n}\n')),(0,a.kt)("p",null,"Use the stringFilter for an even more comprehensive list of options, similar to ",(0,a.kt)("a",{parentName:"p",href:"https://hasura.io/docs/latest/api-reference/graphql-api/query/#text-operators"},"hasura's text filters")))}c.isMDXComponent=!0}}]);