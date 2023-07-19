"use strict";(self.webpackChunkslonik_trpc_docs=self.webpackChunkslonik_trpc_docs||[]).push([[819],{3905:(e,t,n)=>{n.d(t,{Zo:()=>u,kt:()=>f});var r=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function s(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function i(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},o=Object.keys(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var c=r.createContext({}),l=function(e){var t=r.useContext(c),n=t;return e&&(n="function"==typeof e?e(t):s(s({},t),e)),n},u=function(e){var t=l(e.components);return r.createElement(c.Provider,{value:t},e.children)},p="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},m=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,o=e.originalType,c=e.parentName,u=i(e,["components","mdxType","originalType","parentName"]),p=l(n),m=a,f=p["".concat(c,".").concat(m)]||p[m]||d[m]||o;return n?r.createElement(f,s(s({ref:t},u),{},{components:n})):r.createElement(f,s({ref:t},u))}));function f(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=n.length,s=new Array(o);s[0]=m;var i={};for(var c in t)hasOwnProperty.call(t,c)&&(i[c]=t[c]);i.originalType=e,i[p]="string"==typeof e?e:a,s[1]=i;for(var l=2;l<o;l++)s[l]=n[l];return r.createElement.apply(null,s)}return r.createElement.apply(null,n)}m.displayName="MDXCreateElement"},5666:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>c,contentTitle:()=>s,default:()=>p,frontMatter:()=>o,metadata:()=>i,toc:()=>l});var r=n(7462),a=(n(7294),n(3905));const o={sidebar_position:14},s="Distinct on",i={unversionedId:"usage-main-features/distinct",id:"usage-main-features/distinct",title:"Distinct on",description:"DISTINCT ON is a powerful PostgreSQL feature. To use it with your dataloader, you need to specify the sortableColumns option, same as with orderBy.",source:"@site/docs/usage-main-features/distinct.md",sourceDirName:"usage-main-features",slug:"/usage-main-features/distinct",permalink:"/slonik-trpc/docs/usage-main-features/distinct",draft:!1,editUrl:"https://github.com/ardsh/slonik-trpc/tree/main/docs/docs/usage-main-features/distinct.md",tags:[],version:"current",sidebarPosition:14,frontMatter:{sidebar_position:14},sidebar:"tutorialSidebar",previous:{title:"Sorting",permalink:"/slonik-trpc/docs/usage-main-features/sorting"},next:{title:"Cursor-based pagination",permalink:"/slonik-trpc/docs/usage-main-features/cursor-pagination"}},c={},l=[],u={toc:l};function p(e){let{components:t,...n}=e;return(0,a.kt)("wrapper",(0,r.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"distinct-on"},"Distinct on"),(0,a.kt)("p",null,(0,a.kt)("a",{parentName:"p",href:"https://www.postgresql.org/docs/current/sql-select.html"},(0,a.kt)("inlineCode",{parentName:"a"},"DISTINCT ON")," is a powerful PostgreSQL feature"),". To use it with your dataloader, you need to specify the sortableColumns option, same as with ",(0,a.kt)("inlineCode",{parentName:"p"},"orderBy"),"."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},'const postsLoader = makeQueryLoader({\n    db,\n    query,\n    sortableColumns: {\n        name: sql.fragment`users.first_name || users.last_name`,\n        id: ["posts", "id"],\n        date: ["posts", "created_at"],\n        title: "title",\n    },\n});\n')),(0,a.kt)("p",null,"Now you can use these aliases in distinctOn. For example, to get the posts by distinct authors:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},'const distinctAuthors = await postsLoader.load({\n    distinctOn: ["name"]\n    // NOTE: Distinct On automatically adds orderBy fields\n    // So you don\'t have to specify\n    // orderBy: ["name", "ASC"],\n}));\n\nconst sortedByNameAndDate = await postsLoader.load({\n    distinctOn: ["name"]\n    // NOTE: distinctOn rearranges the orderBy fields, if specified, so the leftmost order is the same\n    orderBy: [["date", "ASC"], ["name", "DESC"]],\n    // This example would sort by name DESC first, then date, despite the specified orderBy\n    take: 5,\n}))\n')))}p.isMDXComponent=!0}}]);