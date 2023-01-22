---
sidebar_position: 7
---

# Declaring table columns dependencies type-safely

A common issue when using tRPC over GraphQL is the fact that overfetching is supposed to be solved by GraphQL, but it's not clear how you can do the same thing with tRPC.

I'm gonna try to show a pattern of how to create react tables with optional columns, when not all columns are supposed to be visible to the user.

In that case, we want to fetch only the data for the columns that we display, and not fetch all the data a tRPC query has to offer.

## Setup

I'll use [React Table Library](https://github.com/table-library/react-table-library) for the UI, but this pattern can work with most other tables or datagrids in a very similar way.

## Solution

We can implement selective fetching in our tRPC APIs, using a `select` array that we pass as an argument.

We're gonna abstract this handling of dependencies (and pagination) in its own generic function like below:

```ts title="tableDataLoader.ts"
export const createTableLoader = <TPayload extends Record<string, any>>() => {
  // define initial state, context providers, and reducer
  // ...
  return {
    ContextProvider,
    useVariables,
    createColumn,
    useColumns
  }
}
```

This function takes a generic parameter for the type of data we're trying to load, e.g. an `Employee`  type, and will be responsible for storing the dependencies of all visible columns, as well as making the column declaration type-safe, and any other table-related data fetching responsibilities.

## Example implementation

Let's say you're building a table that displays employee information, using this type:

```ts title="EmployeeList.ts"
type Employee = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  company: {
    name: string;
  };
}
```

Then you'd declare the columns like below:

```ts title="EmployeeList.ts"
const employeeColumns = employeeLoader.useColumns([{
  label: 'Name',
  dependencies: ["firstName", "lastName"],
  renderCell: (employee) => {
    return <div>{employee.firstName} {employee.lastName}</div>
  },
}, {
  label: 'Email',
  dependencies: ["email"],
  renderCell: (employee) => employee.email,
}, {
  label: 'Title',
  dependencies: ["jobTitle"],
  renderCell: (employee) => employee.jobTitle,
}, {
  label: 'Company',
  dependencies: ["company"],
  renderCell: (employee) => employee.company.name,
}]);
```

This is enough for our implementation to work, however, if we want to make each renderCell function get an argument with the correct type, we can use the `createColumn` function to wrap each column, and make it type-safe.

Let's start by declaring the `createColumn` function

```ts title="tableDataLoader.ts"
import type { Column } from '@table-library/react-table-library/types/compact';

type ColumnDefinitions<TPayload> = Omit<Column, "renderCell" | "dependencies"> & {
  renderCell: (item: TPayload) => React.ReactNode,
  dependencies?: readonly (Extract<keyof TPayload, string>)[],
};

export const createTableLoader = <TPayload extends Record<string, any>>() => {
  // ...
  return {
    createColumn: <TDependencies extends keyof TPayload=never>(column: Omit<ColumnDefinitions<TPayload>, "dependencies" | "renderCell"> & {
      dependencies?: TDependencies[],
      renderCell: (data: Pick<TPayload, TDependencies>) =>  React.ReactNode,
    }) => {
      return column;
    },
  // ...
  }
}
```

Whoa, that looks like some complex typescript! What we're essentially doing here though, is restricting the data type, using the [`Pick`](https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys) utility.

So if you specify only the `firstName` field in a column, you won't be able to access other fields in the `renderCell `function. E.g. accessing `employee.email` would result in a typescript error.

Now simply wrap all your columns in this helper function. The best part about this is, you get type-safety AND composability, by declaring the columns in different places, then simply adding them to the array you need.

```ts
export const nameColumn = employeeLoader.createColumn({
  label: 'Name',
  dependencies: ["firstName", "lastName"],
  renderCell: (employee) => {
    return <div>{employee.firstName} {employee.lastName}</div>
  },
});

export const companyColumn = employeeLoader.createColumn({
  label: 'Company',
  dependencies: ["company"],
  renderCell: (employee) => employee.company.name,
});
// ...

const columns = employeeLoader.useColumns([
  nameColumn,
  employeeColumn,
]);
```

### The useColumns implementation

Now we need to actually implement the useColumns function, and the rest of the table data loader.

We start by saving the dependencies array in a reducer.

```ts title="tableDataLoader.ts"
import React from 'react';

type Action = {
  type: "APPEND_FIELDS",
  dependencies: string[]
};

type State = {
  dependencies: string[]
}

const stateReducer = (state: State, action: Action) => {
  switch (action.type) {
    case 'APPEND_FIELDS':
      return {
        ...state,
        // Sort alphabetically to have a stable array
        dependencies: [... new Set(state.dependencies.concat(action.dependencies))].sort(),
      };
    default: return state;
  }
}
```

This is a simple array of unique strings, that are sorted alphabetically (to prevent tRPC refetching queries if the dependent fields are the same but in a different order).

We're gonna pass this dependencies array down using a context provider.

```ts title="tableDataLoader.ts"
export const createTableLoader = <TPayload extends Record<string, any>>() => {
  const initialState = {
    dependencies: [],
  };
  const DependenciesContext = React.createContext([] as (keyof TPayload)[]);
  const DispatchContext = React.createContext((() => {
    throw new Error("tableDataLoader Context provider not found!");
  }) as React.Dispatch<Action>);

  return {
    ContextProvider: ({ children }: { children: React.ReactNode }) => {
      const [state, dispatch] = React.useReducer(stateReducer, initialState);
      return (<DispatchContext.Provider value={dispatch}>
        <DependenciesContext.Provider value={state.dependencies}>
          {children}
        </DependenciesContext.Provider>
      </DispatchContext.Provider>)
    },
    // ...
}
```

The context provider makes it possible to access the state in sub-components.
You simply need to provide it at the root of your page, before you use any loader hooks.

```ts title="EmployeeList.tsx"
<employeeLoader.ContextProvider>
  <EmployeesTable />
</employeeLoader.ContextProvider>
```

Finally, we implement the useColumns and useVariables functions

```ts title="tableDataLoader.ts"
import type { Column } from  '@table-library/react-table-library/types/compact';

const diff = (arr1: any[], arr2: any[]) => {
  return arr1.filter(x => !arr2.includes(x));
}

type ColumnDefinitions<TPayload> = Omit<Column, "renderCell"> & {
  renderCell: (item: TPayload) => React.ReactNode,
  dependencies?: readonly (Extract<keyof TPayload, string>)[],
};

export const createTableLoader = <TPayload  extends  Record<string, any>>() => {
  // ... context state
  return {
    ContextProvider: //...
    useColumns: (columns: ColumnDefinitions<TPayload>[]) => {
      const dispatch = React.useContext(DispatchContext);
      const existingDeps = React.useContext(DependenciesContext);
      React.useEffect(() => {
        const select = columns.flatMap(column => {
          return (column.dependencies || [])
        }).filter(Boolean);
        if (diff(dependencies, existingDeps).length) {
          // We only add fields to dependencies array, without removing.
          dispatch({
            type: 'APPEND_FIELDS',
            dependencies: dependencies,
          });
        }
      }, [existingDeps, columns]);
      return columns;
    },
    useVariables: () => {
      const dependencies = React.useContext(DependenciesContext);
      return React.useMemo(() => ({
        select: dependencies,
      }), [dependencies]);
    },
  }
}
```

We're gonna use the `useVariables` hook to get the select array while fetching the data with trpc, and pass it as an argument.

```ts title="EmployeeList.tsx"
const employeeLoader = createTableLoader<Employee>();

// ...

const { select } = employeeLoader.useVariables();
const { data, isLoading } = trpc.employees.getEmployees.useQuery({
  select,
});
// ...
return <Table data={data.nodes} />
```

So the API will now return just the fields that we actually need to display our columns.

## The complete tableDataLoader implementation

Finally, here's the complete implementation of the table data loader function so far:

```ts
import type { Column } from '@table-library/react-table-library/types/compact';
import React from 'react';

const diff = (arr1: any[], arr2: any[]) => {
  return arr1.filter(x => !arr2.includes(x));
}

type Action = {
  type: "APPEND_FIELDS",
  dependencies: string[]
};

type ColumnDefinitions<TPayload> = Omit<Column, "renderCell" | "dependencies"> & {
  renderCell: (item: TPayload) => React.ReactNode,
  dependencies?: readonly (Extract<keyof TPayload, string>)[],
};

type State = {
  dependencies: string[]
}

const stateReducer = (state: State, action: Action) => {
  switch (action.type) {
    case 'APPEND_FIELDS':
      return {
        ...state,
        // Sort alphabetically to have a stable array
        dependencies: [... new Set(state.dependencies.concat(action.dependencies))].sort(),
      };
    default: return state;
  }
}

export const  createTableLoader = <TPayload  extends  Record<string, any>>() => {
  const initialState = {
    dependencies: [],
  };
  const DependenciesContext = React.createContext([] as (keyof TPayload)[]);
  const DispatchContext = React.createContext((() => {
    throw new Error("tableDataLoader Context provider not found!");
  }) as React.Dispatch<Action>);

  return {
    ContextProvider: ({ children }: { children: React.ReactNode }) => {
      const [state, dispatch] = React.useReducer(stateReducer, initialState);
      return (<DispatchContext.Provider value={dispatch}>
        <DependenciesContext.Provider value={state.dependencies}>
          {children}
        </DependenciesContext.Provider>
      </DispatchContext.Provider>)
    },
    useColumns: (columns: ColumnDefinitions<TPayload>[]) => {
      const dispatch = React.useContext(DispatchContext);
      const existingDeps = React.useContext(DependenciesContext);
      React.useEffect(() => {
        const dependencies = columns.flatMap(column => {
          return (column.dependencies || [])
        }).filter(Boolean);
        if (diff(dependencies, existingDeps).length) {
          // We only add fields to dependencies array, without removing.
          dispatch({
            type: 'APPEND_FIELDS',
            dependencies: dependencies,
          });
        }
      }, [existingDeps, columns]);
      return columns;
    },
    useVariables: () => {
      const dependencies = React.useContext(DependenciesContext);
      return React.useMemo(() => ({
        select: dependencies,
      }), [dependencies]);
    },
    createColumn: <TDependencies extends keyof  TPayload=never>(column: Omit<ColumnDefinitions<TPayload>, "dependencies" | "renderCell"> & {
      dependencies?: TDependencies[],
      renderCell: (data: Pick<TPayload, TDependencies>) =>  React.ReactNode,
    }) => {
      return column;
    },
  }
}
```

And the table component

```ts
import React from 'react';
import { CompactTable } from '@table-library/react-table-library/compact';

import { trpc, type Employee } from '../../utils/trpc';

const employeeTableLoader = createTableLoader<Employee>();

export default function EmployeeList() {
  const employeeColumns = employeeTableLoader.useColumns([
    employeeTableLoader.createColumn({
        label: 'Name',
        dependencies: ["firstName", "lastName"],
        renderCell: (employee) => {
            return <div>{employee.firstName} {employee.lastName}</div>
        },
    }), employeeTableLoader.createColumn({
        label: 'Salary',
        dependencies: ["salary"],
        renderCell: (employee) => employee.salary,
    }), employeeTableLoader.createColumn({
        label: 'Start Date',
        dependencies: ["startDate"],
        renderCell: (employee) => employee.startDate,
    }), employeeTableLoader.createColumn({
        label: 'Company',
        dependencies: ["company"],
        renderCell: (employee) => employee.company,
    })
  ]);

  const pagination = employeeTableLoader.useVariables();

  const { data, isLoading } = trpc.employees.getPaginated.useQuery({
    take: 100,
    ...pagination,
  });

  if (!data) return null;

  return (
    <>
      <CompactTable columns={employeeColumns} data={data} />
    </>
  );
}
```