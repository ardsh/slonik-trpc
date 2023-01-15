import React from 'react';


interface CursorPaginationProps {
    pageSize?: number | string;
    total?: number | string;
    pageSizeOptions?: string[];
    onPageSizeChange?: (pageSize: number) => any;
    onLastPage?: () => any;
    onFirstPage?: () => any;
    onPrevious?: () => any;
    onNext?: () => any;
    currentPage?: number | null,
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
    className?: string;
}

const defaultPageSizes = ['10', '25', '50', '100', '200'];


const CursorPagination: React.FC<CursorPaginationProps> = ({
    pageSizeOptions,
    onPageSizeChange,
    onLastPage,
    onFirstPage,
    onPrevious,
    onNext,
    currentPage,
    hasNextPage,
    hasPreviousPage,
}) => {
    const nextDisabled = hasNextPage === false;
    const previousDisabled = hasPreviousPage === false;
    return (
        <ul>
            <li className='inline m-2 pointer border shadow-md p-1' title="First Page">
                <a onClick={previousDisabled ? undefined : onFirstPage}>&laquo;&laquo;</a>
            </li>
            <li className='inline m-2 pointer border shadow-md p-1' title="Previous Page">
                <a onClick={previousDisabled ? undefined : onPrevious}>&laquo;</a>
            </li>
            {currentPage && <li className='inline m-2' title="Current Page">
                {currentPage}
            </li>}
            <li className='inline m-2 pointer border shadow-md p-1' title="Next Page">
                <a onClick={nextDisabled ? undefined : onNext}>&raquo;</a>
            </li>
            <li className='inline m-2 pointer border shadow-md p-1' title="Last Page">
                <a onClick={nextDisabled ? undefined : onLastPage}>&raquo;&raquo;</a>
            </li>
            <li className='inline'>
                <select
                    onChange={(e: any) => { onPageSizeChange?.(parseInt(e?.target?.value || e, 10)) }}>
                    {(pageSizeOptions || defaultPageSizes).map(size => (
                        <option
                            key={size}
                            value={size}>
                            {size} / page
                        </option>
                    ))}
                </select>
            </li>
        </ul>
    );
};

export default CursorPagination;
