import { z } from 'zod';
import { sql, CommonQueryMethods } from 'slonik';
import { Fragment, Query } from './types';
import { handleZodErrors } from './zod';

const planOutput = z
    .object({
        'Actual Loops': z.number(),
        'Actual Rows': z.number(),
        'Actual Startup Time': z.number(),
        'Actual Total Time': z.number(),
        Alias: z.string(),
        // "Node Type": z.enum(["Subquery Scan", "Limit", "Seq Scan", ""]),
        'Node Type': z.string(),
        'Parallel Aware': z.boolean(),
        'Plan Rows': z.number(),
        'Plan Width': z.number(),
        // "Parent Relationship": z.enum(["Subquery", "Outer"]),
        'Parent Relationship': z.string(),
        'Relation Name': z.string(),
        'Startup Cost': z.number(),
        'Total Cost': z.number(),
    })
    .passthrough()
    .partial();

type Plan = z.infer<typeof planOutput> & {
    Plans?: Plan[];
};
const recursivePlan: z.ZodType<Plan> = z.lazy(() =>
    planOutput.extend({
        Plans: z.array(recursivePlan).optional(),
    })
);

const queryPlanOutput = z
    .object({
        'Execution Time': z.number(),
        'Planning Time': z.number(),
        Plan: recursivePlan,
        Triggers: z.array(z.any()),
    })
    .passthrough();

const explainOutput = z.object({
    'QUERY PLAN': z.array(queryPlanOutput),
});

export function makeQueryAnalyzer(db: CommonQueryMethods) {
    return {
        analyzeQuery: (query: Fragment | Query) => {
            return db
                .any(sql.type(explainOutput)`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`)
                .then((a) => {
                    const result = a[0]?.['QUERY PLAN']?.[0];
                    return {
                        execution: result['Execution Time'],
                        planning: result['Planning Time'],
                        plan: result['Plan'],
                    };
                })
                .catch(handleZodErrors);
        },
    };
}