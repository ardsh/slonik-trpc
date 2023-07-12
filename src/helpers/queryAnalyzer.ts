import * as zod from 'zod';
import { sql, CommonQueryMethods } from 'slonik';
import { Fragment, Query } from './types';
import { makeQueryLoader, InferArgs } from '../core/makeQueryLoader';

export type QueryLoader = ReturnType<typeof makeQueryLoader>;

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

export type GenerateMockOptions<TLoader extends QueryLoader, TWhere=InferArgs<TLoader> extends { where?: infer TWhere } ? Omit<TWhere, "AND" | "OR" | "NOT"> : never> = {
    zodMappers?: {
        [key in keyof typeof zod]?: (field: string, zodType: zod.ZodTypeAny) => (typeof zod[key]) extends zod.ZodType<infer TOutput> ? TOutput : any;
    },
    mappers?: {
        [key in keyof TWhere]?: () =>TWhere[key];
    }
}

function mockZod(field: zod.ZodTypeAny, options?: GenerateMockOptions<any> & { fieldName?: string }): any {
    if (typeof (field as any)?.shape === 'function') {
        return Object.fromEntries(Object.entries((field as any).shape()).map(([key, value]) => [key, mockZod(value as any, {
            ...options,
            fieldName: key,
        })]));
    }
    const fieldName = options?.fieldName || '';
    if (options?.zodMappers && field?._def?.typeName in options.zodMappers) {
        return (options.zodMappers as any)[field._def.typeName](fieldName, field);
    }
    if (options?.mappers && fieldName in options.mappers) {
        return (options.mappers as any)[fieldName](fieldName, field);
    }
    if (field instanceof zod.ZodNumber) {
        return 1;
    } else if (field instanceof zod.ZodString) {
        return '2023-01-01';
    } else if (field instanceof zod.ZodArray) {
        return Math.random() > 0.5 ? [mockZod((field._def as any).type, options)] : [];
    } else if (field instanceof zod.ZodBoolean) {
        return Math.random() > 0.5;
    } else if (field instanceof zod.ZodUnion) {
        return mockZod((field._def as any).options[0], options);
    } else if (field instanceof zod.ZodEnum) {
        return (field._def as any)?.values?.[0];
    } else if (field instanceof zod.ZodNullable || field instanceof zod.ZodOptional) {
        return mockZod((field._def as any).innerType, options);
    } else if (field instanceof zod.ZodEffects) {
        return mockZod((field._def as any).schema, options);
    } else if (field instanceof zod.ZodNever) {
        return undefined;
    } else if (field instanceof zod.ZodNull) {
        return null;
    } else if (field instanceof zod.ZodDefault) {
        return (field._def as any)?.defaultValue();
    } else if (field instanceof zod.ZodLazy) {
        return mockZod((field._def as any).getter()._def, options);
    }
    if (field instanceof zod.ZodObject) {
        const shape = typeof field.shape === 'function' ? field.shape() : field.shape;
        return Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, mockZod(value as any, {
            ...options,
            fieldName: key,
        })]));
    }
    if ((field as any)?._def?.type) {
        return mockZod((field as any)._def, options);
    }
    return field._def?.typeName;
}

export function makeQueryAnalyzer(db: CommonQueryMethods) {
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
                const result = a[0]?.['QUERY PLAN']?.[0];
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
            args?: Omit<InferArgs<TLoader>, "select">
        }) => {
            const { default: Nativebird } = await import('nativebird');
            const selectableFields = queryLoader.getSelectableFields();
            // Analyze every selectable field separately, and then compare which fields take the most time
            const promises = await Nativebird.map(selectableFields, async (field) => {
                const query = await queryLoader.getQuery({
                    take: 100,
                    ...options?.args,
                    select: [field]
                });
                let totalTime = 0;
                for (let i = 0; i < (options?.iterations || 1); i++) {
                    totalTime += await self.analyzeQuery(query).then((a) => a.execution + a.planning);
                }
                return [field, totalTime];
            }, { concurrency: options?.concurrency ?? 1 });
            return Object.fromEntries(promises) as {
                [key in ReturnType<TLoader["getSelectableFields"]>[number]]: number;
            };
        },
        /**
         * Runs the query with mock filters, to see if all the filters are valid.
         * */
        testAllFilters: async <TLoader extends QueryLoader>(queryLoader: TLoader, options?: GenerateMockOptions<TLoader>) => {
            const where = await generateMockFilters(queryLoader, options);
            const query = await queryLoader.getQuery({
                where,
            });
            return self.analyzeQuery(query);
        },
    };
    return self;
}
