"use strict";(self.webpackChunkslonik_trpc_docs=self.webpackChunkslonik_trpc_docs||[]).push([[713],{3905:(e,t,n)=>{n.d(t,{Zo:()=>c,kt:()=>f});var r=n(7294);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?a(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):a(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},a=Object.keys(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var l=r.createContext({}),u=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},c=function(e){var t=u(e.components);return r.createElement(l.Provider,{value:t},e.children)},d="mdxType",p={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},g=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,a=e.originalType,l=e.parentName,c=s(e,["components","mdxType","originalType","parentName"]),d=u(n),g=o,f=d["".concat(l,".").concat(g)]||d[g]||p[g]||a;return n?r.createElement(f,i(i({ref:t},c),{},{components:n})):r.createElement(f,i({ref:t},c))}));function f(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var a=n.length,i=new Array(a);i[0]=g;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s[d]="string"==typeof e?e:o,i[1]=s;for(var u=2;u<a;u++)i[u]=n[u];return r.createElement.apply(null,i)}return r.createElement.apply(null,n)}g.displayName="MDXCreateElement"},8785:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>d,frontMatter:()=>a,metadata:()=>s,toc:()=>u});var r=n(7462),o=(n(7294),n(3905));const a={sidebar_position:9},i="Overfetching",s={unversionedId:"tutorial-getting-started/overfetching",id:"tutorial-getting-started/overfetching",title:"Overfetching",description:"Selecting groups of fields in a query can help you organize your data more effectively and avoid overfetching.",source:"@site/docs/tutorial-getting-started/overfetching.md",sourceDirName:"tutorial-getting-started",slug:"/tutorial-getting-started/overfetching",permalink:"/docs/tutorial-getting-started/overfetching",draft:!1,editUrl:"https://github.com/ardsh/slonik-trpc/tree/main/docs/docs/tutorial-getting-started/overfetching.md",tags:[],version:"current",sidebarPosition:9,frontMatter:{sidebar_position:9},sidebar:"tutorialSidebar",previous:{title:"Authorization",permalink:"/docs/tutorial-getting-started/authorization"},next:{title:"Virtual fields",permalink:"/docs/tutorial-getting-started/virtual-columns"}},l={},u=[{value:"Selecting single columns",id:"selecting-single-columns",level:3},{value:"Grouping columns",id:"grouping-columns",level:3}],c={toc:u};function d(e){let{components:t,...n}=e;return(0,o.kt)("wrapper",(0,r.Z)({},c,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"overfetching"},"Overfetching"),(0,o.kt)("p",null,"Selecting groups of fields in a query can help you organize your data more effectively and avoid overfetching."),(0,o.kt)("p",null,"Selecting fields and groups of fields is fully type-safe. This means you'll get autocomplete functionality only on the fields you select."),(0,o.kt)("h3",{id:"selecting-single-columns"},"Selecting single columns"),(0,o.kt)("p",null,"You can use the select option, to specify the fields you need, and only those will be queried."),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},'const data = await postsLoader.load({\n    select: ["id", "name"]\n}));\n')),(0,o.kt)("h3",{id:"grouping-columns"},"Grouping columns"),(0,o.kt)("p",null,"By organizing your fields into logical groups, you can make it easier to understand the structure of your data and quickly identify which fields you need to query."),(0,o.kt)("p",null,"To group fields in a makeQueryLoader call, pass an object with the group names to the columnGroups option. Then, pass the group names you'd like to select in the selectGroups option when loading items."),(0,o.kt)("p",null,"For example, given the following makeQueryLoader call:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},'const postsLoader = makeQueryLoader({\n    columnGroups: {\n        basic: ["id", "name"],\n        author: ["first_name", "last_name"],\n        extraPostFields: ["created_at", "content"],\n    },\n    query: sql.type(zodType)`SELECT posts.*, users.first_name, users.last_name FROM posts LEFT JOIN users ON users.id = posts.author_id`,\n});\n')),(0,o.kt)("p",null,"You can load only basic fields and author fields, e.g. during a pagination call that only needs the title and author names."),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},'const data = await postsLoader.loadPagination({\n    selectGroups: ["basic", "author"], // Returns id, name, first_name, and last_name\n});\n')),(0,o.kt)("p",null,"Then load more data in a post-specific query"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},'const detailedPostData = await postsLoader.load({\n    take: 1,\n    where: {\n        postIds: 3,\n    },\n    selectGroups: ["basic", "author", "extraPostFields"], // Returns id, name, first_name, and last_name, created_at and content\n});\n')),(0,o.kt)("admonition",{title:"Benefits of selections",type:"tip"},(0,o.kt)("p",{parentName:"admonition"},"Avoiding overfetching can help you save resources on your database server. By querying only the data you need, you can reduce the amount of memory and processing power required to execute your queries. This can help your database server run more efficiently and handle more concurrent requests.")))}d.isMDXComponent=!0}}]);