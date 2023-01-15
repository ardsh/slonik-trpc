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
