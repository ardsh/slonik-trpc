import React from 'react';
import { CompactTable } from '@table-library/react-table-library/compact';
import { useTheme } from '@table-library/react-table-library/theme';
import { DEFAULT_OPTIONS, getTheme } from '@table-library/react-table-library/material-ui';
import { Stack, TextField } from '@mui/material';
import { trpc } from '../../utils/trpc';
import { employeeTableLoader } from './employeeLoader';
import CursorPagination from '../../utils/CursorPagination';

export default function EmployeeList() {

  const [search, setSearch] = React.useState('');
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
    })]);

    const pagination = employeeTableLoader.useVariables();
    const { data, isLoading } = trpc.employees.getPaginated.useQuery(
        {
            ...pagination
        },
        {
            keepPreviousData: true,
        }
    );
    employeeTableLoader.useUpdateQueryData(data);

  const materialTheme = getTheme(DEFAULT_OPTIONS);
  const theme = useTheme(materialTheme);
  const getPaginationProps = employeeTableLoader.usePaginationProps();


  const handleSearch = (event: any) => {
    setSearch(event.target.value);
  };

  if (!data) return null;
  const { edges, pageInfo } = data;

  return (
    <div className='h-screen'>
      <Stack spacing={10}>
        <TextField label="Search Task" value={search} onChange={handleSearch} />
      </Stack>
      <br />

      <CompactTable columns={employeeColumns} data={{
        nodes: edges || [],
        pageInfo,
      }} theme={theme}
      />
      <CursorPagination {...getPaginationProps()} />
      <br />
    </div>
  );
}
