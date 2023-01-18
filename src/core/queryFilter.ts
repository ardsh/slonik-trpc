import { SqlFragment, sql } from "slonik";
import { z } from "zod";
import { notEmpty } from "../helpers/zod";

export type Interpretors<
    TFilter extends Record<string, z.ZodType>,
    TContext = any
> = {
    [x in keyof z.infer<z.ZodObject<TFilter>>]?: (
        filter: z.infer<TFilter[x]>,
        allFilters: z.infer<z.ZodObject<TFilter>>, // Does this need ZodRecursive or not?
        context: TContext
    ) => SqlFragment | null | undefined | false;
};

export type RecursiveFilterConditions<TFilter, TDisabled extends "AND" | "OR" | "NOT"=never> = TFilter & Omit<{
    AND?: RecursiveFilterConditions<TFilter>[];
    OR?: RecursiveFilterConditions<TFilter>[];
    NOT?: RecursiveFilterConditions<TFilter>;
}, TDisabled>;

type ZodRecursiveFilterConditions<TFilter extends Record<string, z.ZodType>> =
    TFilter & {
        AND: z.ZodOptional<
            z.ZodArray<z.ZodObject<ZodRecursiveFilterConditions<TFilter>>>
        >;
        OR: z.ZodOptional<
            z.ZodArray<z.ZodObject<ZodRecursiveFilterConditions<TFilter>>>
        >;
        NOT: z.ZodOptional<z.ZodObject<ZodRecursiveFilterConditions<TFilter>>>;
    };

export const recursiveFilterConditions = <
    TFilter extends Record<string, z.ZodType>,
>(
    filter: TFilter,
    disabledFilters?: {
        [x in "AND" | "OR" | "NOT"]?: boolean
    },
): z.ZodObject<ZodRecursiveFilterConditions<TFilter>> => {
    const filterType: any = z.lazy(() =>
        z.object({
            ...filter,
            ...(!disabledFilters?.OR && { OR: z.array(filterType) }),
            ...(!disabledFilters?.AND && { AND: z.array(filterType) }),
            ...(!disabledFilters?.NOT && { NOT: filterType }),
        }).partial()
    );
    return filterType;
};

export type ZodPartial<TFilter extends Record<string, z.ZodType>> =
    z.ZodOptional<
        z.ZodObject<{
            [k in keyof TFilter]: z.ZodOptional<TFilter[k]>;
        }>
    >;

export type FilterOptions<
    TFilter extends Record<string, z.ZodType>,
    TContext = any
> = {
    /** Use this to pre-process any filters to make them consistent */
    preprocess?: (
        filters: RecursiveFilterConditions<z.infer<ZodPartial<TFilter>>>,
        context: TContext
    ) => z.infer<ZodPartial<TFilter>>;
    /** Use this to add any extra conditions, e.g. for forced authorization checks */
    postprocess?: (
        conditions: SqlFragment[],
        filters: RecursiveFilterConditions<z.infer<ZodPartial<TFilter>>>,
        context: TContext
    ) => SqlFragment[];
};

/**
 * Specify context type first
*/
export const createFilters = <TContext=any>() => <TFilter extends Record<string, z.ZodType>>(filters: TFilter, interpreters: Interpretors<TFilter, TContext>, options?: FilterOptions<TFilter, TContext>) => {
    return {
        filters,
        interpreters,
        options,
    } as const;
}

type Filters<T extends Record<string, z.ZodType>, TContext> = {
    filters: T,
    interpreters: Interpretors<T, TContext>
}
type UnionToIntersection<U> = 
  (U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never

/**
 * Merges two or more filter declarations to allow easy composability.
 * If options is specified, it overwrites the pre and post-processing, and the original functions are NOT called.
 * Otherwise the original postprocessing and preprocessing of filters is kept, and the functions are called sequentially.
*/
export const mergeFilters = <TFilter extends Filters<any, TContext>, TContext=any>(filters: readonly TFilter[], options?: FilterOptions<TFilter["filters"], TContext>) => {
    return {
        filters: filters.reduce((acc, filter) => {
            return {
                ...acc,
                ...filter.filters,
            }
        }, {}),
        interpreters: filters.reduce((acc, filter) => {
            return {
                ...acc,
                ...filter.interpreters,
            }
        }, {}),
        options: options ? options : {
            postprocess(conditions: SqlFragment[], allFilters: TFilter["filters"], context: TContext) {
                return filters.reduce((acc: SqlFragment[], filter: any) => {
                    return filter.options?.postprocess?.(acc, allFilters, context) || acc;
                }, conditions);
            },
            preprocess(allFilters: TFilter["filters"], context: TContext) {
                return filters.reduce((acc: TFilter["filters"], filter: any) => {
                    return filter.options?.preprocess?.(acc, context) || acc;
                }, allFilters);
            }
        },
    } as UnionToIntersection<TFilter>;
}


export function makeFilter<
    TFilter extends Record<string, z.ZodType>,
    TContext = any
>(interpreters: Interpretors<TFilter>, options?: FilterOptions<TFilter>) {
    type ActualFilters = RecursiveFilterConditions<
        z.infer<ZodPartial<TFilter>>
    >;
    const interpretFilter = (filter: ActualFilters, context?: TContext) => {
        const conditions = [] as SqlFragment[];
        const addCondition = (item: SqlFragment | null) =>
            item && conditions.push(item);
        Object.keys(filter).forEach((key: string) => {
            const interpreter = interpreters[key as never] as any;
            const condition = interpreter?.(
                filter[key as never],
                filter as TFilter,
                context
            );
            if (condition) {
                addCondition(condition);
            }
        });
        if (filter.OR?.length) {
            const orConditions = filter.OR.map((or) => {
                const orFilter = interpretFilter(or, context);
                return orFilter?.length
                    ? sql.fragment`(${sql.join(
                          orFilter,
                          sql.fragment`) AND (`
                      )})`
                    : null;
            }).filter(notEmpty);
            if (orConditions?.length) {
                addCondition(
                    sql.fragment`(${sql.join(
                        orConditions,
                        sql.fragment`) OR (`
                    )})`
                );
            }
        }
        if (filter.AND?.length) {
            const andConditions = filter.AND.map((and) => {
                const andFilter = interpretFilter(and, context);
                return andFilter?.length
                    ? sql.fragment`(${sql.join(
                          andFilter,
                          sql.fragment`) AND (`
                      )})`
                    : null;
            }).filter(notEmpty);
            if (andConditions?.length) {
                addCondition(
                    sql.fragment`(${sql.join(
                        andConditions,
                        sql.fragment`) AND (`
                    )})`
                );
            }
        }
        if (filter.NOT) {
            const notFilter = interpretFilter(filter.NOT, context);
            if (notFilter.length) {
                addCondition(
                    sql.fragment`NOT (${sql.join(
                        notFilter,
                        sql.fragment`) AND (`
                    )})`
                );
            }
        }

        // return sql.fragment`(${sql.join(conditions, sql.fragment`) AND (`)})`;
        return conditions;
    };
    const getConditions = (filters: ActualFilters, context?: TContext) => {
        const conditions = interpretFilter(
            options?.preprocess?.(filters, context) || filters,
            context
        );
        return (
            options?.postprocess?.(conditions, filters, context) || conditions
        );
    };
    const getWhereFragment = (filter: ActualFilters, context?: TContext) => {
        const conditions = getConditions(filter, context);
        return conditions?.length
            ? sql.fragment`(${sql.join(conditions, sql.fragment`)\n AND (`)})\n`
            : sql.fragment`TRUE`;
    };
    return getWhereFragment;
}
