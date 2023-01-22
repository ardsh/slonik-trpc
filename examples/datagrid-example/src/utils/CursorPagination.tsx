import React from 'react';
import { twMerge } from 'tailwind-merge';

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
        <ul className='select-none'>
            <li className={twMerge('inline m-2 rounded-md text-white bg-blue-500 hover:bg-blue-600 cursor-pointer', previousDisabled && 'bg-gray-400 hover:bg-gray-600')} title="First Page">
                <a className='p-2' onClick={previousDisabled ? undefined : onFirstPage}>&laquo;&laquo;</a>
            </li>
            <li className={twMerge('inline rounded-md text-white bg-blue-500 hover:bg-blue-600 cursor-pointer', previousDisabled && 'bg-gray-400 hover:bg-gray-600')} title="Previous Page">
                <a className='p-2' onClick={previousDisabled ? undefined : onPrevious}>&laquo;</a>
            </li>
            {currentPage && <li className='inline m-2' title="Current Page">
                {currentPage}
            </li>}
            <li className={twMerge('inline rounded-md text-white bg-blue-500 hover:bg-blue-600 cursor-pointer', nextDisabled && 'bg-gray-400 hover:bg-gray-600')} title="Next Page">
                <a className='p-2' onClick={nextDisabled ? undefined : onNext}>&raquo;</a>
            </li>
            <li className={twMerge('inline m-2 rounded-md text-white bg-blue-500 hover:bg-blue-600 cursor-pointer', nextDisabled && 'bg-gray-400 hover:bg-gray-600')} title="Last Page">
                <a className='p-2' onClick={nextDisabled ? undefined : onLastPage}>&raquo;&raquo;</a>
            </li>
            <li className='inline'>
                <select defaultValue={10}
                    onChange={(e: any) => { onPageSizeChange?.(parseInt(e?.target?.value || e, 10)) }}>
                    {(pageSizeOptions || defaultPageSizes).map(size => (
                        <option
                            className='text-black bg-blue-200'
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
