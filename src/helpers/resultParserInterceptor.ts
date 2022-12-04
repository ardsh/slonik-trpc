import {
    type Interceptor,
    type QueryResultRow,
    SchemaValidationError,
} from "slonik";

export const createResultParserInterceptor = (): Interceptor => {
    return {
        // If you are not going to transform results using Zod, then you should use `afterQueryExecution` instead.
        // Future versions of Zod will provide a more efficient parser when parsing without transformations.
        // You can even combine the two – use `afterQueryExecution` to validate results, and (conditionally)
        // transform results as needed in `transformRow`.
        transformRow: (executionContext, actualQuery, row) => {
            const { log, resultParser } = executionContext;

            if (!resultParser) {
                return row;
            }

            const validationResult = resultParser.safeParse(row);

            if (!validationResult.success) {
                const msg = validationResult.error.issues.map(
                    (issue, idx) => `Error #${idx + 1}: Code: ${issue.code} ~ Path: ${issue.path.join('->')} ~ Message: ${issue.message}`
                );
                console.error(msg.join('\n'));
                throw new SchemaValidationError(
                    actualQuery,
                    row as any,
                    validationResult.error.issues
                );
            }

            return validationResult.data as QueryResultRow;
        },
    };
};
