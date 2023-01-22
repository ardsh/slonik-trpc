import React from "react";

export interface GetCursorPaginationProps {
    (): CursorPagination
}

export const initialCursorPagination: CursorPagination = {
    hasNextPage: false,
    currentPage: 1,
    hasPreviousPage: false,
    currentCursor: '',
    startCursor: '',
    endCursor: '',
    reverse: false,
    pageSize: 10,
}

export type CursorPaginationAction = {
    type: 'UPDATE_DATA',
    data: {
        startCursor?: string | null,
        endCursor?: string | null,
        hasNextPage?: boolean,
        hasPreviousPage?: boolean,
    }
} | {
    type: 'TABLE_CHANGE',
    pageSize: number,
} | {
    type: 'FIRST_PAGE',
} | {
    type: 'LAST_PAGE',
} | {
    type: 'NEXT_PAGE',
} | {
    type: 'PREVIOUS_PAGE',
}

export type CursorPagination = {
    /** The current page cursor. If empty, we're in the first page.
     * Whenever we change the page, this changes.
    */
    currentCursor?: string,
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

export function cursorPaginationReducer(state: CursorPagination = initialCursorPagination, action: CursorPaginationAction): CursorPagination {
    switch (action.type) {
        case 'TABLE_CHANGE':
            return {
                ...state,
                currentCursor: '', // Go to first page
                currentPage: 1,
                hasNextPage: true,
                hasPreviousPage: false,
                reverse: false,
                pageSize: action.pageSize,
            }
        case 'UPDATE_DATA':
            return {
                ...state,
                ...(action.data?.startCursor && { startCursor: action.data.startCursor }),
                ...(action.data?.endCursor && { endCursor: action.data.endCursor }),
                hasNextPage: action.data?.hasNextPage,
                hasPreviousPage: action.data?.hasPreviousPage,
            }
        case 'NEXT_PAGE':
            return {
                ...state,
                // Increment current page tracker if currentPage wasn't null
                currentPage: state.currentPage !== null && state.currentCursor !== state.endCursor ?
                    (state.currentPage || 1) + 1 : null,
                hasPreviousPage: true,
                hasNextPage: false,
                currentCursor: state.endCursor,
                reverse: false,
            }
        case 'PREVIOUS_PAGE':
            return {
                ...state,
                // Keep track of current page in the counter
                currentPage: state.currentPage !== null && state.currentCursor !== state.startCursor ?
                    Math.max(1, (state.currentPage || 1) - 1) : null,
                hasNextPage: true,
                hasPreviousPage: false,
                currentCursor: state.startCursor,
                reverse: true,
            }
        case 'LAST_PAGE':
            return {
                ...state,
                // Setting currentPage to null when going to last page because total count is unknown
                currentPage: null,
                hasPreviousPage: true,
                hasNextPage: false,
                currentCursor: '',
                reverse: true,
            }
        case 'FIRST_PAGE':
            return {
                ...state,
                currentPage: 1,
                hasNextPage: true,
                hasPreviousPage: false,
                currentCursor: '',
                reverse: false,
            }
        default:
            return state;
    }
}

export const useCursorPaginationActions = (dispatch: React.Dispatch<CursorPaginationAction>) => {
    return React.useMemo(() => ({
        onPageSizeChange: (pageSize: number) => {
            dispatch({
                type: 'TABLE_CHANGE',
                pageSize
            })
        },
        onDataChange: (data: { startCursor?: string, endCursor?: string, hasNextPage?: boolean, hasPreviousPage?: boolean }) => dispatch({
            type: 'UPDATE_DATA',
            data,
        }),
        onLastPage: () => {
            dispatch({
                type: 'LAST_PAGE',
            });
        },
        onFirstPage: () => {
            dispatch({
                type: 'FIRST_PAGE'
            });
        },
        onPrevious: () => {
            dispatch({
                type: 'PREVIOUS_PAGE',
            });
        },
        onNext: () => {
            dispatch({
                type: 'NEXT_PAGE',
            });
        },
    }), [dispatch]);
};

export interface CursorPaginationProps {
    onPageSizeChange?: (pageSize: number) => any,
    initialPagination?: CursorPagination,
}

export function useCursorPaginationProps(props: CursorPaginationProps) {
    const { initialPagination: initialPage } = props;
    const [pagination, dispatch] = React.useReducer(cursorPaginationReducer, {
        ...initialCursorPagination,
        ...initialPage,
    });

    const actions = useCursorPaginationActions(dispatch);

    const getPaginationProps: GetCursorPaginationProps = React.useCallback(() => ({
        ...pagination,
        ...actions,
    }), [actions, pagination]);

    const { currentCursor, pageSize = 10, reverse } = pagination;
    const getPaginationVariables = React.useCallback(() => ({
        take: reverse ? -pageSize : pageSize,
        takeCursors: true,
        cursor: currentCursor,
    }), [pageSize, currentCursor, reverse]);

    return React.useMemo(() => ({
        getPaginationProps,
        getPaginationVariables,
    }), [getPaginationProps, getPaginationVariables])
}
