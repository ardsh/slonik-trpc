"use strict";(self.webpackChunkslonik_trpc_docs=self.webpackChunkslonik_trpc_docs||[]).push([[112],{3905:(e,t,n)=>{n.d(t,{Zo:()=>l,kt:()=>m});var r=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},o=Object.keys(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var p=r.createContext({}),u=function(e){var t=r.useContext(p),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},l=function(e){var t=u(e.components);return r.createElement(p.Provider,{value:t},e.children)},c="mdxType",g={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},d=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,o=e.originalType,p=e.parentName,l=s(e,["components","mdxType","originalType","parentName"]),c=u(n),d=a,m=c["".concat(p,".").concat(d)]||c[d]||g[d]||o;return n?r.createElement(m,i(i({ref:t},l),{},{components:n})):r.createElement(m,i({ref:t},l))}));function m(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=n.length,i=new Array(o);i[0]=d;var s={};for(var p in t)hasOwnProperty.call(t,p)&&(s[p]=t[p]);s.originalType=e,s[c]="string"==typeof e?e:a,i[1]=s;for(var u=2;u<o;u++)i[u]=n[u];return r.createElement.apply(null,i)}return r.createElement.apply(null,n)}d.displayName="MDXCreateElement"},7866:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>p,contentTitle:()=>i,default:()=>c,frontMatter:()=>o,metadata:()=>s,toc:()=>u});var r=n(7462),a=(n(7294),n(3905));const o={sidebar_position:15},i="Cursor-based pagination",s={unversionedId:"usage-main-features/cursor-pagination",id:"usage-main-features/cursor-pagination",title:"Cursor-based pagination",description:"To use cursor-based pagination, start by specifying takeCursors: true in your options. This will return a startCursor and endCursor in the pagination response.",source:"@site/docs/usage-main-features/cursor-pagination.md",sourceDirName:"usage-main-features",slug:"/usage-main-features/cursor-pagination",permalink:"/slonik-trpc/docs/usage-main-features/cursor-pagination",draft:!1,editUrl:"https://github.com/ardsh/slonik-trpc/tree/main/docs/docs/usage-main-features/cursor-pagination.md",tags:[],version:"current",sidebarPosition:15,frontMatter:{sidebar_position:15},sidebar:"tutorialSidebar",previous:{title:"Distinct on",permalink:"/slonik-trpc/docs/usage-main-features/distinct"},next:{title:"Aggregating",permalink:"/slonik-trpc/docs/usage-main-features/grouping"}},p={},u=[{value:"Going to next page",id:"going-to-next-page",level:2},{value:"Going to previous page",id:"going-to-previous-page",level:2},{value:"Manual searchAfter option",id:"manual-searchafter-option",level:2},{value:"Paging backwards",id:"paging-backwards",level:3}],l={toc:u};function c(e){let{components:t,...n}=e;return(0,a.kt)("wrapper",(0,r.Z)({},l,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"cursor-based-pagination"},"Cursor-based pagination"),(0,a.kt)("p",null,"To use cursor-based pagination, start by specifying ",(0,a.kt)("inlineCode",{parentName:"p"},"takeCursors: true")," in your options. This will return a ",(0,a.kt)("inlineCode",{parentName:"p"},"startCursor")," and ",(0,a.kt)("inlineCode",{parentName:"p"},"endCursor")," in the pagination response."),(0,a.kt)("p",null,"Use these cursors in the cursor pagination when you want to go to the next (or previous page)."),(0,a.kt)("h2",{id:"going-to-next-page"},"Going to next page"),(0,a.kt)("p",null,"Specify"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"cursor: endCursor,\ntake: 25\n")),(0,a.kt)("p",null,"To get the next 25 items after the current page."),(0,a.kt)("h2",{id:"going-to-previous-page"},"Going to previous page"),(0,a.kt)("p",null,"Specify"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},"cursor: startCursor,\ntake: -25\n")),(0,a.kt)("p",null,"This will get the previous page, before the current one."),(0,a.kt)("h2",{id:"manual-searchafter-option"},"Manual searchAfter option"),(0,a.kt)("p",null,"You can also specify the searchAfter option in the pagination arguments. This option takes an object of sortable column values. These values are dependent on the ",(0,a.kt)("a",{parentName:"p",href:"/slonik-trpc/docs/usage-main-features/sorting"},"sortable columns")," option."),(0,a.kt)("p",null,"For example, if you want to retrieve the next 25 items in the dataset after a specific element, you can do something like this:"),(0,a.kt)("p",null,"This method is not recommended, over using the ",(0,a.kt)("inlineCode",{parentName:"p"},"cursor")," option, since it's a more complicated method of achieving the same thing. Opaque ",(0,a.kt)("a",{parentName:"p",href:"https://slack.engineering/evolving-api-pagination-at-slack/"},"base-64 encoded cursors are overall much better.")),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},'const nextPage = await postsLoader.loadPagination({\n    orderBy: [["name", "ASC"], ["id", "ASC"]],\n    searchAfter: {\n        name: "Bob",\n        id: 65,\n    },\n    take: 25,\n});\n')),(0,a.kt)("p",null,"Note that for cursor-based pagination to work, the items need to be sorted by a unique, sequential column or combination of columns."),(0,a.kt)("h3",{id:"paging-backwards"},"Paging backwards"),(0,a.kt)("p",null,"If you specify a negative number for the ",(0,a.kt)("inlineCode",{parentName:"p"},"take")," option, you'll be page to get the previous page:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-ts"},'const previousPage = await postsLoader.loadPagination({\n    orderBy: [["name", "DESC"], ["id", "ASC"]],\n    searchAfter: {\n        name: "Bob",\n        id: 65,\n    },\n    take: -25,\n});\n')))}c.isMDXComponent=!0}}]);