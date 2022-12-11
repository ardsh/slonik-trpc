"use strict";(self.webpackChunkslonik_trpc_docs=self.webpackChunkslonik_trpc_docs||[]).push([[431],{3905:(e,t,n)=>{n.d(t,{Zo:()=>u,kt:()=>f});var a=n(7294);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,a,r=function(e,t){if(null==e)return{};var n,a,r={},o=Object.keys(e);for(a=0;a<o.length;a++)n=o[a],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(a=0;a<o.length;a++)n=o[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var p=a.createContext({}),l=function(e){var t=a.useContext(p),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},u=function(e){var t=l(e.components);return a.createElement(p.Provider,{value:t},e.children)},c="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},g=a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,o=e.originalType,p=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),c=l(n),g=r,f=c["".concat(p,".").concat(g)]||c[g]||d[g]||o;return n?a.createElement(f,i(i({ref:t},u),{},{components:n})):a.createElement(f,i({ref:t},u))}));function f(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var o=n.length,i=new Array(o);i[0]=g;var s={};for(var p in t)hasOwnProperty.call(t,p)&&(s[p]=t[p]);s.originalType=e,s[c]="string"==typeof e?e:r,i[1]=s;for(var l=2;l<o;l++)i[l]=n[l];return a.createElement.apply(null,i)}return a.createElement.apply(null,n)}g.displayName="MDXCreateElement"},6681:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>p,contentTitle:()=>i,default:()=>c,frontMatter:()=>o,metadata:()=>s,toc:()=>l});var a=n(7462),r=(n(7294),n(3905));const o={sidebar_position:5},i="Offset-based pagination",s={unversionedId:"tutorial-getting-started/pagination",id:"tutorial-getting-started/pagination",title:"Offset-based pagination",description:"Offset-based pagination allows you to specify the number of items to take and skip when requesting a page of results. This can be useful when working with large datasets and you only need a portion of the data at a time.",source:"@site/docs/tutorial-getting-started/pagination.md",sourceDirName:"tutorial-getting-started",slug:"/tutorial-getting-started/pagination",permalink:"/docs/tutorial-getting-started/pagination",draft:!1,editUrl:"https://github.com/ardsh/slonik-trpc/tree/main/docs/docs/tutorial-getting-started/pagination.md",tags:[],version:"current",sidebarPosition:5,frontMatter:{sidebar_position:5},sidebar:"tutorialSidebar",previous:{title:"Usage",permalink:"/docs/tutorial-getting-started/usage"},next:{title:"Usage with tRPC",permalink:"/docs/tutorial-getting-started/trpc"}},p={},l=[{value:"Retrieving count",id:"retrieving-count",level:2}],u={toc:l};function c(e){let{components:t,...n}=e;return(0,r.kt)("wrapper",(0,a.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"offset-based-pagination"},"Offset-based pagination"),(0,r.kt)("p",null,"Offset-based pagination allows you to specify the number of items to take and skip when requesting a page of results. This can be useful when working with large datasets and you only need a portion of the data at a time."),(0,r.kt)("p",null,"To use offset-based pagination, you can specify the take and skip options when calling the loadPagination method:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const posts = await postsLoader.loadPagination({\n    take: 50,\n    skip: 75,\n});\n")),(0,r.kt)("p",null,"This will return an object with the following shape:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n    "edges": [{\n        // ...posts array with 50 items.\n    }],\n    "hasNextPage": true,\n    // Letting you know there\'s an extra page, because at least 76 items were loaded (75 skipped + 50 take + 1)\n    "minimumCount": 126,\n    "count": null,\n}\n')),(0,r.kt)("h2",{id:"retrieving-count"},"Retrieving count"),(0,r.kt)("p",null,"If you need to know the total number of items in the result set, as if no take or skip options were applied, you can specify the ",(0,r.kt)("inlineCode",{parentName:"p"},"takeCount: true")," option. By default, this option is set to false to avoid costly count queries."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const posts = await postsLoader.loadPagination({\n    take: 25,\n    skip: 50,\n    takeCount: true,\n});\n")),(0,r.kt)("p",null,"This may return an object with the following shape:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n    "edges": [{\n        // ...posts array with 25 items.\n    }],\n    "hasNextPage": true,\n    // Letting you know there\'s an extra page, because at least 76 items were loaded (50 skipped + 25 take + 1)\n    "minimumCount": 76,\n    "count": 443,\n}\n')),(0,r.kt)("admonition",{title:"Avoid",type:"danger"},(0,r.kt)("p",{parentName:"admonition"},"It is recommended to avoid using takeCount: true if possible, for performance reasons. Instead, you can use the minimumCount or hasNextPage properties to determine whether there is a next page.")))}c.isMDXComponent=!0}}]);