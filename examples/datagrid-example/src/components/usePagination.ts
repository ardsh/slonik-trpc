import { useMemo, useReducer } from 'react';

type Action =
    | { type: "SET_CURRENT_PAGE"; payload: number }
    | { type: "SET_COUNT"; payload: number }
    | { type: "SET_PAGE_SIZE"; payload: number };

type Pagination = {
    currentPage: number;
    pageSize: number;
    totalCount: number;
};

export const usePagination = (initialState?: Partial<Pagination>) => {
    const [state, dispatch] = useReducer((state: Pagination, action: Action) => {
        switch (action.type) {
            case "SET_CURRENT_PAGE":
                return {
                    ...state,
                    currentPage: action.payload,
                };
            case "SET_PAGE_SIZE":
                return {
                    ...state,
                    pageSize: action.payload,
                };
            case "SET_COUNT":
                return {
                    ...state,
                    totalCount: action.payload,
                };
            default:
                return state;
        }
    }, {
        ...initialState,
        pageSize: 25,
        currentPage: 0,
        totalCount: 0
    });

    const onPageChange = (page: number) =>
        dispatch({ type: "SET_CURRENT_PAGE", payload: page });
    const onPageSizeChange = (size: number) =>
        dispatch({ type: "SET_PAGE_SIZE", payload: size });
    const onTotalCountChange = (size: number) =>
        dispatch({ type: "SET_COUNT", payload: size });

    return useMemo(() => ({
        pagination: state,
        onPageChange,
        onTotalCountChange,
        onPageSizeChange,
    }), [state]);
};
