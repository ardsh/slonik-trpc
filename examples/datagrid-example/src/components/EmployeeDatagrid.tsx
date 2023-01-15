import * as React from "react";
import {
    DataGrid,
    GridColDef,
    GridFilterModel,
    GridToolbar,
    GridSortModel,
    GridValueGetterParams,
} from "@mui/x-data-grid";

import Box from "@mui/material/Box";
import { trpc } from "../utils/trpc";

import type {
    EmployeeLoader,
    InferPayload,
} from "../server/db/loaders/employeeLoader";
import { usePagination } from "./usePagination";

const VISIBLE_COLUMNS = [
    "id",
    "name",
    "salary",
    "company",
    "startDate",
    "endDate",
] as const;

function useVisibleColumns() {
    return VISIBLE_COLUMNS;
}

type Employee = InferPayload<EmployeeLoader, any>;

const columns: GridColDef<Employee>[] = [
    {
        field: "id",
        filterable: true,
        headerName: "ID",
        width: 130,
    },
    {
        field: "name",
        headerName: "Full name",
        width: 220,
        valueGetter: (params: GridValueGetterParams<any, Employee>) =>
            `${params.row.firstName || ""} ${params.row.lastName || ""}`,
    },
    {
        field: "salary",
        filterable: true,
        headerName: "Salary",
        type: "number",
        width: 150,
    },
    {
        field: "company",
        headerName: "Company",
        type: "number",
        width: 150,
    },
    {
        field: "startDate",
        filterable: true,
        headerName: "Start Date",
        type: "date",
        width: 200,
    },
    {
        field: "endDate",
        filterable: true,
        headerName: "End Date",
        type: "date",
        width: 200,
    },
];

function convertFilterItem(column: keyof Employee) {
    switch (column) {
        case "company":
            return "companyName";
        case "endDate":
            return "employmentEndDate";
        case "startDate":
            return "employmentStartDate";
        case "salary":
            return "employmentSalary";
        case "id":
            return "employeeId";
    }
}
function convertFilterOperator(operator?: string, value?: any) {
    switch (operator) {
        case ">": case ">=":
            return {
                _gt: value,
            };
        case "<": case "<=":
            return {
                _lt: value,
            };
        default:
            return value;
    }
}

export default function QuickFilteringGrid() {
    const visibleColumns = useVisibleColumns();
    const [queryOptions, setQueryOptions] = React.useState({
        sortModel: [] as GridSortModel,
        filterModel: {
            items: [{
                columnField: "salary",
                operatorValue: ">",
                value: 30000,
            }],
        } as GridFilterModel,
    });

    const { pagination, onPageChange, onPageSizeChange, onTotalCountChange } =
        usePagination({
            pageSize: 100,
        });
    const { data, isLoading } = trpc.employees.getPaginated.useQuery(
        {
            take: pagination.pageSize,
            skip: pagination.currentPage * pagination.pageSize,
            // takeCount: true,
            where: {
                employeeName: queryOptions.filterModel.quickFilterValues || [],
                AND: (queryOptions.filterModel.items || [])
                    .map((item) => {
                        const field = convertFilterItem(
                            item.columnField as any
                        );
                        const value = convertFilterOperator(
                            item.operatorValue,
                            item.value
                        );
                        if (field && value) {
                            return {
                                [field]: value,
                            };
                        }
                    })
                    .filter(Boolean),
            },
            orderBy: !queryOptions.sortModel?.length
                ? undefined
                : queryOptions.sortModel?.map(
                      ({ field, sort }) =>
                          [field, sort === "asc" ? "ASC" : "DESC"] as [
                              any,
                              "ASC" | "DESC"
                          ]
                  ),
        },
        {
            keepPreviousData: true,
        }
    );
    const onFilterChange = React.useCallback((filterModel: GridFilterModel) => {
        console.log("FIlter change", filterModel);
        setQueryOptions((options) => ({
            ...options,
            filterModel: { ...filterModel },
        }));
    }, []);

    const onSortModelChange = React.useCallback((sortModel: GridSortModel) => {
        setQueryOptions((options) => ({
            ...options,
            sortModel: [...sortModel],
        }));
    }, []);
    const filteredColumns = React.useMemo(
        () =>
            columns.filter((column) =>
                visibleColumns.includes(column.field as any)
            ),
        [visibleColumns]
    );
    return (
        <div className="min-h-screen min-w-full">
            <DataGrid
                rows={data?.edges || []}
                disableColumnFilter
                disableColumnSelector
                disableDensitySelector
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                columns={filteredColumns}
                components={{ Toolbar: GridToolbar }}
                filterMode="server"
                onFilterModelChange={onFilterChange}
                filterModel={queryOptions.filterModel}
                initialState={{
                    filter: {
                        filterModel: {
                            items: [{
                                columnField: "salary",
                                operatorValue: ">",
                                value: 30000,
                            }],
                        }
                    },
                    sorting: {
                        sortModel: [{ field: "name", sort: "asc" }],
                    },
                }}
                page={pagination.currentPage}
                pageSize={pagination.pageSize}
                rowsPerPageOptions={[10, 25, 50, 100]}
                rowCount={data?.pageInfo?.count || data?.pageInfo?.minimumCount || 0}
                paginationMode="server"
                sortingMode="server"
                onSortModelChange={onSortModelChange}
                componentsProps={{
                    toolbar: {
                        showQuickFilter: true,
                        quickFilterProps: { debounceMs: 500 },
                    },
                }}
            />
        </div>
    );
}
