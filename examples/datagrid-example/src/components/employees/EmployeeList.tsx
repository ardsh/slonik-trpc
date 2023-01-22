import React from 'react';
import { CompactTable } from '@table-library/react-table-library/compact';
import { useTheme } from '@table-library/react-table-library/theme';
import { DEFAULT_OPTIONS, getTheme } from '@table-library/react-table-library/material-ui';
import { Stack, TextField } from '@mui/material';
import { trpc } from '../../utils/trpc';
import { EmployeeInput, employeeTableLoader } from './employeeLoader';
import CursorPagination from '../../utils/CursorPagination';
import { useSort } from '@table-library/react-table-library/sort';

export default function EmployeeList() {

  const [search, setSearch] = React.useState('');
  const [orderBy, setOrderBy] = React.useState(["id", "ASC"] as EmployeeInput["orderBy"]);
  const employeeColumns = employeeTableLoader.useColumns([
    employeeTableLoader.createColumn({
        label: 'Name',
        dependencies: ["firstName", "lastName"],
        sort: {
          sortKey: "name",
        },
        renderCell: (employee) => {
            return <div>{employee.firstName} {employee.lastName}</div>
        },
    }), employeeTableLoader.createColumn({
        label: 'Salary',
        dependencies: ["salary"],
        sort: {
          sortKey: "salary",
        },
        renderCell: (employee) => employee.salary,
    }), employeeTableLoader.createColumn({
        label: 'Start Date',
        dependencies: ["startDate"],
        sort: {
          sortKey: "startDate",
        },
        renderCell: (employee) => employee.startDate,
    }), employeeTableLoader.createColumn({
          label: 'End Date',
          dependencies: ["endDate"],
          sort: {
            sortKey: "endDate",
          },
          renderCell: (employee) => employee.endDate,
    }), employeeTableLoader.createColumn({
        label: 'Days employed',
        dependencies: ["employed_days"],
        sort: {
          sortKey: "daysEmployed",
        },
        renderCell(employee) {
          return employee.employed_days;
        },
    }), employeeTableLoader.createColumn({
        label: 'Company',
        dependencies: ["company"],
        sort: {
          sortKey: "company",
        },
        renderCell: (employee) => employee.company,
    })]);

    const pagination = employeeTableLoader.useVariables();
    const { data, isLoading } = trpc.employees.getPaginated.useQuery(
        {
            ...pagination,
            orderBy,
            where: {
              employeeName: search,
            }
        },
        {
            keepPreviousData: true,
        }
    );
    employeeTableLoader.useUpdateQueryData(data);

  const materialTheme = getTheme(DEFAULT_OPTIONS);
  const theme = useTheme(materialTheme);
  const getPaginationProps = employeeTableLoader.usePaginationProps();

  const paginationProps = getPaginationProps();

  const handleSearch = (event: any) => {
    setSearch(event.target.value);
    paginationProps.onFirstPage();
  };

  const sort = useSort(
    data as any,
    {
      onChange: (action: any, state: any) => {
        paginationProps.onFirstPage();
        setOrderBy([state.sortKey, state.reverse ? "DESC" : "ASC"]);
      },
    }, {
      isServer: true,
      sortFns: {},
    }
  );
  if (!data) return null;

  return (
    <div className='h-screen'>
      <Stack spacing={10}>
        <TextField label="Search" value={search} onChange={handleSearch} />
      </Stack>
      <br />

      <CompactTable sort={sort} columns={employeeColumns} data={data} theme={theme}

      />
      <CursorPagination {...getPaginationProps()} />
      <br />
    </div>
  );
}
