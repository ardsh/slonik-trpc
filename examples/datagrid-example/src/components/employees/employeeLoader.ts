import type { InferPayload, EmployeeLoader } from '../../server/db/loaders/employeeLoader';
import { createTableLoader } from '../../utils/table';

export type Employee = InferPayload<EmployeeLoader, {
    takeCursors: false,
}>

export const employeeTableLoader = createTableLoader<Employee>();
