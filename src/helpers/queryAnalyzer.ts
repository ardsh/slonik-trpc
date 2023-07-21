
import { sql, CommonQueryMethods } from 'slonik';
import { Fragment, Query } from './types';
import { makeQueryLoader, InferArgs } from '../core/makeQueryLoader';
import { GenerateMockOptions, mockZod } from './zod';

export type QueryLoader = Pick<ReturnType<typeof makeQueryLoader>, "getLoadArgs" | "getSelectableFields" | "load">;

export type PlanOutput = {
    'Actual Loops'?: number;
    'Actual Rows'?: number;
    'Actual Startup Time'?: number;
    'Actual Total Time'?: number;
    Alias?: string;
    'Node Type'?: string;
    'Parallel Aware'?: boolean;
    'Plan Rows'?: number;
    'Plan Width'?: number;
    'Parent Relationship'?: string;
    'Relation Name'?: string;
    'Startup Cost'?: number;
    'Total Cost'?: number;
};

export type Plan = PlanOutput & {
    Plans?: Plan[];
};

export type QueryPlanOutput = {
    'Execution Time': number;
    'Planning Time': number;
    Plan: Plan;
    Triggers: any[];
};

export type ExplainOutput = {
    'QUERY PLAN': QueryPlanOutput[];
};


export function makeQueryAnalyzer(db: Pick<CommonQueryMethods, "any">) {
    const generateMockFilters = async <TLoader extends QueryLoader>(queryLoader: TLoader, options?: GenerateMockOptions<TLoader>) => {
        const args = await queryLoader.getLoadArgs({
            sortableColumns: [] as any,
            disabledFilters: {
                AND: true,
                OR: true,
                NOT: true,
            }
        }).pick({
            where: true,
        });
        const mocked = mockZod(args, options);
        return mocked.where;
    };
    const self = {
        analyzeQuery: (query: Fragment | Query) => {
            return db
            .any(sql.unsafe`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`)
            .then((a: readonly ExplainOutput[]) => {
                const result = a[0]['QUERY PLAN'][0];
                return {
                    execution: result['Execution Time'],
                    planning: result['Planning Time'],
                    plan: result['Plan'],
                };
            })
        },
        /** Runs each field as a separate query, to try and find which fields take more time to resolve.
         * This is useful when you have sub-queries as fields, and you want to know which sub-queries are heavy.
         * @returns A number in milliseonds for each field
         * */
        benchmarkQueryLoaderFields: async <TLoader extends QueryLoader>(queryLoader: TLoader, options?: {
            /** How many times to run a query for each field */
            iterations?: number;
            /** How many fields queries to run concurrently */
            concurrency?: number;
            args?: Omit<InferArgs<TLoader>, "select"> & { ctx?: any };
        }) => {
            const { iterations=1, concurrency=1, args } = options || {};
            const { default: Nativebird } = await import('nativebird');
            const selectableFields = queryLoader.getSelectableFields();
            // Analyze every selectable field separately, and then compare which fields take the most time
            const promises = await Nativebird.map(selectableFields, async (field) => {
                const query = await (queryLoader as any).getQuery({
                    take: 100,
                    ...args,
                    select: [field]
                });
                let totalTime = 0;
                for (let i = 0; i < iterations; i++) {
                    totalTime += await self.analyzeQuery(query).then((a) => a.execution + a.planning);
                }
                return [field, totalTime];
            }, { concurrency });
            return Object.fromEntries(promises) as {
                [key in ReturnType<TLoader["getSelectableFields"]>[number]]: number;
            };
        },
        /**
         * Runs the query with mock filters, to see if all the filters are valid.
         * */
        testAllFilters: async <TLoader extends QueryLoader>(queryLoader: TLoader, options?: GenerateMockOptions<TLoader>) => {
            const where = await generateMockFilters(queryLoader, options);
            const query = await (queryLoader as any).getQuery({
                where,
            });
            return self.analyzeQuery(query);
        },
    };
    return self;
}
