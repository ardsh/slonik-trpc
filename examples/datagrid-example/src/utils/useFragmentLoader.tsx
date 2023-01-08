import React from 'react';

const diff = (arr1: any[], arr2: any[]) => {
    return arr1.filter(x => !arr2.includes(x));
}

type Action = {
    type: "SELECT_FIELDS",
    select: string[]
} | {
    type: "SELECT_ALL_FIELDS",
} | {
    type: "SELECT_IDS",
    ids: string[]
} | {
    type: "UPDATE_DATA",
    data: any[]
}

interface UseFragment<TPayload> {
    <TSelect extends Exclude<keyof TPayload, number | symbol>=Exclude<keyof TPayload, number | symbol>>(id?: string, select?: TSelect[]): Pick<TPayload, TSelect> | undefined
    <TSelect extends Exclude<keyof TPayload, number | symbol>=Exclude<keyof TPayload, number | symbol>>(id?: string[], select?: TSelect[]): Pick<TPayload, TSelect>[] | undefined
}

const emptyArray = [] as any[];
/**
 * This is supposed to provide relay-like fragment selection.
 * 
 * Usage:
 * Create a loader with a type
 * ```ts
 * const employeeLoader = createFragmentLoader<Employee>();
 * ```
 * 
 * Use the main context provider on the root of your page
 * 
 * ```tsx
 * <employeeLoader.ContextProvider>
 *     <div>Your Page</div>
 * </employeeLoader.ContextProvider>
 * ```
 * When loading your query, get the selected fields
 * ```ts
 * const selected = employeeLoader.useSelectedFields();
 * const ids = employeeLoader.useIds();
 * const { data } = trpc.useQuery(['employees.getEmployees', {
 *     select: selected,
 *     where: {
 *         employeeIDs: ids
 *     },
 * }])
 * // Do not forget to update the data
 * employeeLoader.useUpdateQueryData(data);
 * ```
 * 
 * When using the data in your components, simply supply the ids and the fields you need.
 * ```ts
 * const employee = employeeLoader.useFragment(props.employeeID, ['id', 'salary', 'first_name']);
 * ```
 * 
 * If you don't supply a select array, ALL fields will be selected. Be careful with that, always supply an array if you know which fields you need.
 * */
export const createFragmentLoader = <TPayload extends { id?: any }>() => {
    const reducer = (state: typeof initialState, action: Action) => {
        switch (action.type) {
            case 'SELECT_FIELDS':
                return {
                    ...state,
                    select: [... new Set(state.select.concat(action.select))].sort(),
                };
            case 'SELECT_ALL_FIELDS':
                return {
                    ...state,
                    allselected: true,
                };
            case 'SELECT_IDS':
                return {
                    ...state,
                    id: [... new Set(state.select.concat(action.ids))].sort(),
                };
            case 'UPDATE_DATA':
                return {
                    ...state,
                    data: action.data,
                };
            default:
                return state;
        }
    }

    const initialData = [] as TPayload[];
    const initialState = {
        data: initialData,
        select: [] as any[],
        allselected: false,
        id: [] as string[],
    };

    const SelectContext = React.createContext([] as Exclude<keyof TPayload, number | symbol>[]);
    const IDsContext = React.createContext([] as string[]);
    const DataRefContext = React.createContext({ current: initialData } as React.MutableRefObject<typeof initialData>);
    const DataContext = React.createContext(initialData as typeof initialData);
    const DispatchContext = React.createContext((null as unknown) as React.Dispatch<Action>);

    const ContextProvider = ({ children }: { children: React.ReactNode }) => {
        const [state, dispatch] = React.useReducer(reducer, initialState);

        const dataRef = React.useRef(initialData);

        return (<DispatchContext.Provider value={dispatch}>
            <IDsContext.Provider value={state.id}>
                <DataRefContext.Provider value={dataRef}>
                    <DataContext.Provider value={state.data}>
                        <SelectContext.Provider value={state.allselected ? emptyArray : state.select}>
                            {children}
                        </SelectContext.Provider>
                    </DataContext.Provider>
                </DataRefContext.Provider>
            </IDsContext.Provider>
        </DispatchContext.Provider>);
    };

    const useUpdateQueryData = (data?: TPayload[] | readonly TPayload[] | null) => {
        const dataRef = React.useContext(DataRefContext);
        const dispatch = React.useContext(DispatchContext);
        if (data) {
            dataRef.current = data as any;
        }
        React.useEffect(() => {
            if (data) {
                dispatch({
                    type: 'UPDATE_DATA',
                    data: data as any[],
                });
            }
        }, [data]);
    };

    return {
        ContextProvider,
        useUpdateQueryData,
        createGroup<TSelect extends Exclude<keyof TPayload, number | symbol>>(select: TSelect[]) {
            return select;
        },
        useSelectedFields: () => {
            const select = React.useContext(SelectContext);
            return select;
        },
        useFragment: ((id?: string | string[], select?: string[]) => {
            // Should cause re-render when data is changed...
            const data = React.useContext(DataContext);
            const dataRef = React.useContext(DataRefContext);
            const dispatch = React.useContext(DispatchContext);
            const selected = React.useContext(SelectContext);
            React.useEffect(() => {
                if (!select) {
                    // Select all fields
                    dispatch({
                        type: 'SELECT_ALL_FIELDS',
                    });
                } else if (diff(select, selected).length) {
                    // Only dispatch when adding fields...no need to remove
                    dispatch({
                        type: 'SELECT_FIELDS',
                        select: select,
                    });
                }
            }, [select, selected]);
            React.useEffect(() => {
                if (id) {
                    dispatch({
                        type: 'SELECT_IDS',
                        ids: Array.isArray(id) ? id : [id].filter(Boolean)
                    });
                }
            }, [id]);

            if (Array.isArray(dataRef.current)) {
                if (Array.isArray(id)) {
                    return id.map(id => dataRef.current.find(item => item.id === id));
                } else {
                    return dataRef.current.find(item => item.id === id);
                }
            } else {
                console.warn('Data is not array: ', dataRef.current);
                return undefined;
            }
        }) as UseFragment<TPayload>,
    };
};
