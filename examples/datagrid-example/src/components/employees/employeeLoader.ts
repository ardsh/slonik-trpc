import type { InferPayload, EmployeeLoader, InferArgs } from '../../server/db/loaders/employeeLoader';
import { createTableLoader } from '../../utils/table';

export type Employee = InferPayload<EmployeeLoader, {
    takeCursors: false,
}>

export type EmployeeInput = InferArgs<EmployeeLoader>;

export const employeeTableLoader = createTableLoader<Employee>();
