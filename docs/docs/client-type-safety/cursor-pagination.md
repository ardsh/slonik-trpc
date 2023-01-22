---
sidebar_position: 9
---

# Cursor Pagination

You can read about cursor pagination and its benefits [in this article from slack](https://slack.engineering/evolving-api-pagination-at-slack/).

In this tutorial I want to demonstrate how to load data in a table using cursor pagination.

Normally we use offset-based pagination for loading tabular data, but it is possible to simulate a very similar experience (navigating through pages bidirectionally) using cursor-based pagination, or a mix of cursor+offset based pagination, since `slonik-trpc` offers both.  
By a mix, I mean using offset-based pagination to "jump" forward or backwards more than one page at a time.

The main use-cases:
- Load a page of employees in a table of employees.
- Navigate to the next page, or the previous page (two-way cursor pagination).
- Jump to the last page, or the first page.
- Jump two pages forwards, or two pages backwards.

### Saving the pagination state

We start by defining the pagination state in a reducer.

```ts title="useCursorPagination.ts"
type CursorPagination = {
    /** The current page cursor. If empty, we're in the first page.
     * Whenever we change the page, this changes.
     * */
    currentCursor?: string,
    /** How many items are being skipped. Used for skipping pages when navigating */
    skip?: number,
    /** A counter that keeps track of the current page.
     * Useful if we want to show a page number in the UI */
    currentPage?: number | null,
    /** The first cursor of the current page, as specified by the data source*/
    startCursor?: string,
    /** The end cursor of the current page, as specified by the data source */
    endCursor?: string,
    /** Whether the data source has a next page */
    hasNextPage?: boolean,
    /** Whether the data source has a previous page */
    hasPreviousPage?: boolean,
    /** Whether we're paging backwards (used when going to previous/last page) */
    reverse?: boolean,
    /** The amount of items to take */
    pageSize?: number,
}
```

And we'll use these actions to change the data:

```ts
export type CursorPaginationAction = {
    type: 'UPDATE_DATA',
    // Update cursors when data changes
    data: {
        startCursor?: string | null,
        endCursor?: string | null,
        hasNextPage?: boolean,
        hasPreviousPage?: boolean,
    }
} | {
    type: 'TABLE_CHANGE',
    // Change the page size
    pageSize: number,
} | {
    type: 'FIRST_PAGE',
} | {
    type: 'LAST_PAGE',
} | {
    type: 'NEXT_PAGE',
    // Optional telling how many pages to skip (normally 0)
    skipPages?: number,
} | {
    type: 'PREVIOUS_PAGE',
    skipPages?: number,
}
```

The actual reducer is fairly boilerplate, I'll show it at the end.

#### Navigating from within the reducer

I want the pagination reducer to be fully responsible for navigation.

To do this, the reducer has to keep track of the start and end cursors of each page, in the pagination state.

For example, when the `NEXT_PAGE` action is dispatched, I want to fetch the next 25 items after the current page.

So in that case the reducer should set the currentCursor to the `endCursor` of the current page, and to do that it needs to know what the `endCursor` of the current page is at all times.

To keep the reducer state up to date with these cursors, we can create a hook function and call it directly below the `useQuery` hook of `tRPC`.

```ts
const { data, isLoading } = trpc.employees.getEmployees.useQuery(...);
employeeLoader.useUpdateQueryData(data);
```

We add this hook to the table data loader function from earlier.

```ts title="tableDataLoader.ts"
useUpdateQueryData: (data?: {
  nodes?: readonly TPayload[] | null,
  pageInfo?: {
    hasNextPage?: boolean,
    hasPreviousPage?: boolean,
    startCursor?: string | null,
    endCursor?: string | null,
  }
}) => {
  const dispatch = React.useContext(DispatchContext);

  React.useEffect(() => {
    if (data) {
      dispatch({
        type: 'UPDATE_DATA',
        data: data?.pageInfo,
      });
    }
  }, [data, dispatch]);
},
```

Note that I'm calling dispatch on a different reducer than the pagination reducer here.

This is because I want the entire table state to be in one place, and to do this I'm adding the pagination state as a sub-object of the main table state.

```ts title="tableDataLoader.ts"
import { CursorPaginationAction, CursorPagination, cursorPaginationReducer } from './useCursorPagination';

type Action = {
  type: "APPEND_FIELDS",
  dependencies: string[]
} | CursorPaginationAction;

const stateReducer = (state: State, action: Action) => {
  switch (action.type) {
    case 'APPEND_FIELDS':
      return {
        ...state,
        // Sort alphabetically to have a stable array
        dependencies: [... new Set(state.dependencies.concat(action.dependencies))].sort(),
      };
    default: return {
      ...state,
      pagination: cursorPaginationReducer(state.pagination, action),
    };
  }
}
```

Now `state.dependencies` saves the array of dependencies, and `state.pagination` saves the pagination state.

These two states can be provided on separate contexts, to prevent unnecessary re-renders.

```ts title="tableDataLoader.ts"
export const createTableLoader = <TPayload extends Record<string, any>>() => {
  const initialState = {
    dependencies: [],
    pagination: initialCursorPagination,
  };
  const DependenciesContext = React.createContext([] as (keyof TPayload)[]);
  const PaginationContext = React.createContext(initialCursorPagination);
  const DispatchContext = React.createContext((() => {
    throw new Error("tableDataLoader Context provider not found!");
  }) as React.Dispatch<Action>);

  return {
    ContextProvider: ({ children }: { children: React.ReactNode }) => {
      const [state, dispatch] = React.useReducer(stateReducer, initialState);
      return (<DispatchContext.Provider value={dispatch}>
        <DependenciesContext.Provider value={state.dependencies}>
          <PaginationContext.Provider value={state.pagination}>
            {children}
          </PaginationContext.Provider>
        </DependenciesContext.Provider>
      </DispatchContext.Provider>)
    },
    // ...
```

## Pagination Component

We can build a UI component that has 4 buttons (first, previous, next, last) and a page size dropdown.

This component would allow going to previous pages, next pages, the first page, or last page. It would also allow the user to change how many items the table should show in a page.

### Pagination Props

I want to simply call usePaginationProps and pass its return value down to the CursorPagination component, and not worry about managing the pagination state of specific tables.

```ts title="EmployeeList.tsx"
<CursorPagination {...employeeLoader.usePaginationProps()} />
```

This is very useful when we have lots of different tables, and we don't want to write code for handling each one of them.

### usePaginationProps

The `CursorPagination` component is dependent on this hook, which means this hook should return functions like `onNext`, `onPrevious`, and `currentPage`.

All of these are stored within the cursor pagination state, or are action dispatcher functions (e.g. `onNext`):

```ts title="tableDataLoader.ts"
usePaginationProps: () => {
  const dispatch = React.useContext(DispatchContext);
  const pagination = React.useContext(PaginationContext);

  return React.useMemo(() => ({
    onNext: (skipPages=0) => dispatch({ type: 'NEXT_PAGE', skipPages: parseInt(skipPages) }),
    onPrevious: (skipPages=0) => dispatch({ type: 'PREVIOUS_PAGE', skipPages: parseInt(skipPages) }),
    onLast: () => dispatch({ type: 'LAST_PAGE' }),
    onFirst: () => dispatch({ type: 'LAST_PAGE' }),
    onPageSizeChange: (pageSize: number) => dispatch({ type: 'TABLE_CHANGE', pageSize }),
    currentPage: pagination.currentPage,
  }), [dispatch, pagination]);
},
```

### Usage in query

We just need to update `take`, `cursor` etc. in the variables of the query

```ts title="tableDataLoader.ts"
useVariables: () => {
  const dependencies = React.useContext(DependenciesContext);

  const { pageSize = 25, reverse, currentCursor, skip = 0 } = React.useContext(PaginationContext);

  return React.useMemo(() => ({
    select: dependencies,
    take: reverse ? -pageSize : pageSize,
    takeCursors: true,
    cursor: currentCursor,
    skip,
  }), [currentCursor, dependencies, pageSize, reverse, skip]);
},
```

Usage:

```ts title="EmployeeList.tsx"
const pagination = employeeLoader.useVariables();
const { data, isLoading } = trpc.employees.getEmployees.useQuery({
    ...pagination,
});
employeeLoader.useUpdateQueryData(data);
```

### Switching sorting columns

One thing to be careful here is when sorting data with different columns, the cursor won't be stable.
So when we change the sorting columns, we need to reset the cursor as well. Usually that means going to the first page (an empty cursor means we're in the first page).

```ts title="EmployeeList.tsx"
import { useSort } from '@table-library/react-table-library/sort';

// ...

const [orderBy, setOrderBy] = React.useState();

const paginationProps = employeeLoader.usePaginationProps();
const pagination = employeeLoader.useVariables();

const { data, isLoading } = trpc.employees.getEmployees.useQuery({
    ...pagination,
    orderBy,
});
employeeLoader.useUpdateQueryData(data);

const sort = useSort(data, {
  onChange: (action: any, state: any) => {
    // Reset to first page when sorting changes
    paginationProps.onFirstPage();
    setOrderBy([state.sortKey, state.reverse ? "DESC" : "ASC"]);
  },
}, {
  isServer: true,
  sortFns: {},
});
```

## Complete Implementation

You can see a similar example implementation at [slonik-trpc/examples/datagrid-example](https://githubbox.com/ardsh/slonik-trpc/tree/main/examples/datagrid-example)

### The reducer implementation

This is the complete implementation of `useCursorPagination.ts` actions and reducer.

```ts title="useCursorPagination.ts"
import React from "react";

export const initialCursorPagination: CursorPagination = {
    hasNextPage: false,
    currentPage: 1,
    skip: 0,
    hasPreviousPage: false,
    currentCursor: '',
    startCursor: '',
    endCursor: '',
    reverse: false,
    pageSize: 25,
}

type CursorPagination = {
    /** The current page cursor. If empty, we're in the first page.
     * Whenever we change the page, this changes.
     * */
    currentCursor?: string,
    /** How many items are being skipped. Used for skipping pages when navigating */
    skip?: number,
    /** A counter that keeps track of the current page.
     * Useful if we want to show a page number in the UI */
    currentPage?: number | null,
    /** The first cursor of the current page, as specified by the data source*/
    startCursor?: string,
    /** The end cursor of the current page, as specified by the data source */
    endCursor?: string,
    /** Whether the data source has a next page */
    hasNextPage?: boolean,
    /** Whether the data source has a previous page */
    hasPreviousPage?: boolean,
    /** Whether we're paging backwards (used when going to previous/last page) */
    reverse?: boolean,
    /** The amount of items to take */
    pageSize?: number,
}

export type CursorPaginationAction = {
    type: 'UPDATE_DATA',
    // Update cursors when data changes
    data: {
        startCursor?: string | null,
        endCursor?: string | null,
        hasNextPage?: boolean,
        hasPreviousPage?: boolean,
    }
} | {
    type: 'TABLE_CHANGE',
    // Change the page size
    pageSize: number,
} | {
    type: 'FIRST_PAGE',
} | {
    type: 'LAST_PAGE',
} | {
    type: 'NEXT_PAGE',
    // Optional telling how many pages to skip (normally 0)
    skipPages?: number,
} | {
    type: 'PREVIOUS_PAGE',
    skipPages?: number,
}

export function cursorPaginationReducer(state: CursorPagination = initialCursorPagination, action: CursorPaginationAction): CursorPagination {
    switch (action.type) {
        case 'TABLE_CHANGE':
            return {
                ...state,
                currentCursor: '', // Go to first page when changing page size
                skip: 0,
                currentPage: 1,
                hasNextPage: true,
                hasPreviousPage: false,
                reverse: false,
                pageSize: action.pageSize,
            }
        case 'UPDATE_DATA':
            return {
                ...state,
                // If we skipped pages too much, and reached further than the last page, we should revert back to skip:0)
                // If there's no startCursor, it must mean we skipped too much.
                ...(!action.data.startCursor && state.skip && {
                    skip: 0,
                    currentPage: state.currentPage !== null ?
                        Math.max(1, (state.currentPage || 1) - Math.floor(state.skip / (state.pageSize || 25))) : null,
                }),
                startCursor: action.data.startCursor || '',
                endCursor: action.data.endCursor || '',
                hasNextPage: !!action.data.hasNextPage,
                hasPreviousPage: !!action.data.hasPreviousPage,
            }
        case 'NEXT_PAGE':
            return {
                ...state,
                currentPage: state.currentPage !== null && state.currentCursor !== state.endCursor ?
                    Math.max(1, (state.currentPage || 1) + 1 + (action.skipPages || 0)) : null,
                hasPreviousPage: true,
                hasNextPage: false,
                skip: (action.skipPages || 0) * (state.pageSize || 25),
                currentCursor: state.endCursor,
                reverse: false,
            }
        case 'PREVIOUS_PAGE':
            return {
                ...state,
                currentPage: state.currentPage !== null && state.currentCursor !== state.startCursor ?
                    Math.max(1, (state.currentPage || 1) - 1 - (action.skipPages || 0)) : null,
                hasNextPage: true,
                hasPreviousPage: false,
                skip: (action.skipPages || 0) * (state.pageSize || 25),
                currentCursor: state.startCursor,
                reverse: true,
            }
        case 'LAST_PAGE':
            return {
                ...state,
                currentPage: null,
                hasPreviousPage: true,
                hasNextPage: false,
                currentCursor: '',
                skip: 0,
                reverse: true,
            }
        case 'FIRST_PAGE':
            return {
                ...state,
                currentPage: 1,
                hasNextPage: true,
                hasPreviousPage: false,
                currentCursor: '',
                skip: 0,
                reverse: false,
            }
        default:
            return state;
    }
}
```

Also an example of [the CursorPagination component can be found on github](https://github.com/ardsh/slonik-trpc/blob/main/examples/datagrid-example/src/utils/CursorPagination.tsx)
