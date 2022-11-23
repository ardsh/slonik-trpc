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

export const handleZodErrors = (err: Error) => {
    // Catch Zod errors, format them properly for easier debugging/reading.
    if (err instanceof SchemaValidationError) {
        const msg = err.issues.map(
            (issue, idx) =>
                `Error #${idx + 1}: Code: ${issue.code} ~ Path: ${issue.path.join(
                    '->'
                )} ~ Message: ${issue.message}`
        );
        throw new Error(msg.join('~\n'));
    }
    throw err;
};
