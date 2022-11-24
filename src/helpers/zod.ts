import { z, ZodError } from 'zod';
import { SchemaValidationError } from 'slonik';

export function notEmpty<TValue>(value: TValue | null | undefined | void): value is TValue {
    return value !== null && value !== undefined;
}

export const arrayifyType = <T extends z.ZodType>(type: T) =>
z.preprocess(
    (a) => (Array.isArray(a) ? a : [a].filter(notEmpty)),
    z.union([z.array(type), type])
);
