import { sql, CommonQueryMethods, QuerySqlToken, SqlFragment } from "slonik";
import { z } from 'zod';
import { notEmpty } from "../helpers/zod";
import { RemoveAny } from '../helpers/types';
import { FilterOptions, Interpretors, makeFilter, RecursiveFilterConditions, recursiveFilterConditions, ZodPartial } from "./queryFilter";

const orderDirection = z.enum(["ASC", "DESC", "ASC NULLS LAST", "DESC NULLS LAST"]);
type OrderField = [string, z.infer<typeof orderDirection>];

function getOrderByDirection(field: OrderField) {
    switch (field[1]) {
    case 'ASC': return sql.fragment`ASC`;
    case 'ASC NULLS LAST': return sql.fragment`ASC NULLS LAST`;
    case 'DESC': return sql.fragment`DESC`;
    case 'DESC NULLS LAST': return sql.fragment`DESC NULLS LAST`;
    }
}

function interpretOrderBy(field: OrderField) {
    return sql.fragment`ORDER BY ${sql.identifier([field[0]])} ${getOrderByDirection(field)}`;
}

type LoadParameters<
    TFilter,
    TContext,
    TObject extends Record<string, any>,
    TSelect extends keyof TObject,
    TExclude extends keyof TObject = never,
    TSortable extends string = never,
> = {
    /** The fields that should be included. If unspecified, all fields are returned. */
    select?: readonly TSelect[];
    /** The fields that should be excluded. Takes precedence over `select`. */
    exclude?: readonly TExclude[];
    /** The amount of rows to query */
    limit?: number;
    /** Specify the count of items to skip, usually (currentPage - 1) * limit */
    skip?: number;
    orderBy?: [TSortable] extends [never] ? never : [TSortable, 'ASC' | 'DESC' | 'ASC NULLS LAST' | 'DESC NULLS LAST'] | null;
    context?: TContext;
    where?: RecursiveFilterConditions<TFilter>;
};

type ResultType<
    TObject extends z.AnyZodObject,
    TVirtuals extends Record<string, any>,
    TPostprocessed extends Record<string, any>,
    TDefaultExcluded extends Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>,
    TRequired extends readonly [keyof z.infer<TObject>, ...(keyof z.infer<TObject>)[]],
    TSelect extends keyof (TVirtuals & z.infer<TObject>),
    TExclude extends keyof (TVirtuals & z.infer<TObject>)
> = Omit<
    // Include only the difference of TPostprocessed - TVirtuals
    // Because only those fields are always present after post-processing
    Omit<RemoveAny<TPostprocessed>, keyof (TPostprocessed | (z.infer<TObject> & TVirtuals))> &
    Pick<
        TVirtuals & z.infer<TObject>,
        [TSelect] extends [never] ? Exclude<keyof (TVirtuals & z.infer<TObject>), TDefaultExcluded> : (TSelect | TRequired[number])
    >,
    [TExclude] extends [never] ? Exclude<TDefaultExcluded, TSelect> : Exclude<TExclude, TRequired[number]>
>;

const countQueryType = z.object({
    count: z.number(),
});

function resolveTransformers<TData>(dataTransformers: any[], rows: readonly TData[]): Promise<TData[]> {
    return Promise.all(rows.map(async (data) => {
        const promises = await Promise.all(dataTransformers.map(async (transformer) => {
            const newData = await transformer(data);
            for (const key in newData) {
                // TODO: Separate virtual fields from overall transformers to not need to await each key
                newData[key] = await newData[key];
            }
            return newData ?? data;
        }));
        return promises.reduce((acc, transformed) => {
            return {
                ...acc,
                ...transformed,
            }
        }, {
            ...data,
        });
    }));
}

export function makeQueryLoader<
    TFilterTypes extends Record<string, z.ZodTypeAny>,
    TContextZod extends z.ZodTypeAny,
    TFragment extends SqlFragment | QuerySqlToken,
    TRequired extends readonly [keyof z.infer<TObject>, ...(keyof z.infer<TObject>)[]]=[never],
    TObject extends z.AnyZodObject=TFragment extends QuerySqlToken<infer T> ? T : any,
    TVirtuals extends Record<string, any> = z.infer<TObject>,
    TPostprocessed extends Record<string, any> = z.infer<TObject>,
    // TSortable extends keyof z.infer<TObject> = never,
    TSortable extends string = never,
    TSelectable extends Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>
        = Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>,
    TDefaultExcluded extends Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol> = never
>(options: {
    query: TFragment,
    type?: TObject,
    contextParser?: TContextZod,
    db?: Pick<CommonQueryMethods, "any">
    /** If you specify custom filters, make sure the fields they reference are accessible from the main query*/
    filters?: {
        filters: TFilterTypes,
        interpreters: Interpretors<TFilterTypes, z.infer<TContextZod>>,
        options?: FilterOptions<TFilterTypes, z.infer<TContextZod>>
    }
    sortableColumns?: readonly [TSortable, ...TSortable[]];
    selectableColumns?: readonly [TSelectable, ...TSelectable[]];
    defaultExcludedColumns?: readonly [TDefaultExcluded, ...TDefaultExcluded[]];
    /**
     * Specify a mapping of virtual fields, with their dependencies
    */
    virtualFields?: {
        [x in keyof TVirtuals]?: {
            /** Return the virtual field */
            resolve: (row: z.infer<TObject>) => PromiseLike<TVirtuals[x]> | TVirtuals[x];
            dependencies: readonly (keyof z.infer<TObject>)[];
        };
    };
    /** Specify the fields that will always be required, no matter what the select/exclude options are. */
    required?: TRequired;
    /** A function to postprocess the output.
     * Do NOT use this to declare virtual fields, it's much more limited.
     * Instead, use this when it's necessary to change an existing field, e.g. easier formatting.
     * */
    postprocess?: (data: z.infer<TObject>) => PromiseLike<TPostprocessed> | TPostprocessed;
}) {
    const query = options.query;
    const type = options.type || (query as QuerySqlToken).parser as z.AnyZodObject;
    if (!type || !type.keyof || !type.partial) throw new Error('Invalid query type provided: ' + (type));
    type TFilter = z.infer<ZodPartial<TFilterTypes>>;
    const interpretFilters = options?.filters?.interpreters ? makeFilter<TFilterTypes, z.infer<TContextZod>>(options.filters.interpreters, options.filters?.options) : null;
    const dataTransformers = [] as ((data: any) => any)[];
    const sortFields = options?.sortableColumns?.length
            ? z.enum(options.sortableColumns)
            : // If unspecified, no field is allowed to be used for sorting
            (z.never() as never);
    const orderByType = z.tuple([sortFields, orderDirection]);
    const getQuery = <
        TSelect extends keyof (TVirtuals & z.infer<TObject>) = string,
        TExclude extends keyof (TVirtuals & z.infer<TObject>) = never,//TDefaultExcluded[number], Shouldn't exclude defaults
    >({
        where,
        limit,
        skip,
        orderBy,
        context,
        select,
        exclude,
    }: LoadParameters<
        TFilter,
        z.infer<TContextZod>,
        TPostprocessed & TVirtuals & z.infer<TObject>,
        (TSelect | TRequired[number]) & TSelectable,
        TExclude,
        TSortable
    >) => {
        const whereCondition = interpretFilters?.(where || ({} as any), context);
        const isPartial = select?.length || exclude?.length || options.defaultExcludedColumns?.length;
        // TODO: Add virtual fields transformations to zodType with transform optionally.
        const zodType: z.ZodType<ResultType<TObject, TVirtuals, TPostprocessed, TDefaultExcluded, TRequired, TSelect, TExclude>>
            = (isPartial ? type.partial() : type) as any;
        if (options.defaultExcludedColumns && !exclude) {
            exclude = Array.from(options.defaultExcludedColumns)
                // Select has precedence over default exclusion
                .filter(field => !select?.includes(field as any)) as any[];
        }
        const noneSelected = !select?.length;
        const noneExcluded = !exclude?.length;
        if (typeof options?.postprocess === 'function') {
            dataTransformers.push(options.postprocess);
        }
        const virtuals = Object.keys(options?.virtualFields || {});
        if (virtuals.length) {
            const selected = select || [];
            const transformer = virtuals
                .map((key: any) => {
                    if ((noneSelected || selected.includes(key)) &&
                        (noneExcluded || !exclude?.includes(key)) &&
                        options?.virtualFields?.[key]?.resolve) {
                        return [key, options?.virtualFields?.[key]?.resolve] as const;
                    }
                    return null;
                })
                .filter(notEmpty);
            transformer.forEach(([key, transformer]) => {
                if (typeof transformer === 'function') {
                    dataTransformers.push((data) => {
                        data[key] = transformer(data);
                        return data;
                    })
                }
            })
        }
        const parsedOrderBy = orderBy?.length ? orderByType.parse(orderBy) : null;
        // TODO: Wrap the base query to allow all kinds of queries
        const baseQuery = sql.type(zodType)`${query}
        ${whereCondition ? sql.fragment`WHERE ${whereCondition}` : sql.fragment``}
        ${parsedOrderBy ? interpretOrderBy(parsedOrderBy) : sql.fragment``}
        ${typeof limit === 'number' ? sql.fragment`LIMIT ${limit}` : sql.fragment``}
        ${typeof skip === 'number' ? sql.fragment`OFFSET ${skip}` : sql.fragment``}
        `;
        const requiredFields = options?.required || ([] as string[]);
        const requiredDependencies = (select || []).flatMap(field => (options?.virtualFields?.[field]?.dependencies as any[]) || []);
        const fields = Object.keys(type?.keyof?.()?.Values || {}) as any[];
        const selectable = options?.selectableColumns;
        select = (select || [])
            .filter(field => !selectable?.length || selectable.indexOf(field) >= 0)
            .concat(requiredFields as never)
            // Add dependencies from selected fields.
            .flatMap((field) => [
                field,
                ...((options?.virtualFields?.[field]?.dependencies as any[]) || []),
            ])
            .filter((field) => !fields?.length || fields?.indexOf(field) >= 0);
        const finalKeys = Array.from(new Set(fields
            .filter(notEmpty)
            .filter((column) => noneSelected || select?.includes(column as any))
            // Exclusion takes precedence
            .filter(
                (column) =>
                    noneExcluded ||
                    !exclude?.includes(column) ||
                    requiredDependencies.includes(column) ||
                    requiredFields.includes(column)
            )).values());

        // Run another root query, that only selects the column names that aren't excluded, or only ones that are included.
        const finalQuery =
            select?.length || exclude?.length
                ? sql.type(zodType)`WITH root_query AS (${baseQuery})
            SELECT ${sql.join(
                finalKeys.map((a) => sql.identifier([a])),
                sql.fragment`, `
            )} FROM root_query`
                : baseQuery;
        return finalQuery;
    };
    const getSelectableFields = () => {
        const selectable = options?.selectableColumns;
        const columns = Object.keys(options?.virtualFields || {}).concat(
            Object.keys(type?.keyof?.()?.Values || {})
        ) as [
            TSelectable,
            ...TSelectable[]
        ];
        if (selectable?.length) {
            return columns.filter(column => selectable.indexOf(column as any) >= 0) as never;
        }
        return columns;
    };

    const getLoadArgs = <
        TFields extends string = TSelectable,
        TSort extends string = TSortable,
    >(
        {
            sortableColumns = options?.sortableColumns as never,
            selectableColumns = options?.selectableColumns as never,
        }: {
            sortableColumns?: [TSort, ...TSort[]];
            selectableColumns?: [TFields, ...TFields[]];
        } = {} as never
    ) => {
        const sortFields = sortableColumns?.length
            ? z.enum(sortableColumns)
            : // If unspecified, no field is allowed to be used for sorting
            (z.never() as never);
        const selectColumns = (selectableColumns || options.selectableColumns);
        const fields = selectColumns?.length
            ? z.enum(selectColumns)
            : // If unspecified, any field is allowed to be selected
            (z.string() as never)
        type ActualFilters = RecursiveFilterConditions<
            z.infer<ZodPartial<TFilterTypes>>>;
        return z.object({
            /** The fields that should be included. If unspecified, all fields are returned. */
            select: z.array(fields).optional(),
            /** The fields that should be excluded. Takes precedence over `select`. */
            exclude: z.array(fields).optional(),
            limit: z.number().optional(),
            skip: z.number().optional().default(0),
            takeCount: z.boolean().optional(),
            takeNextPages: z.number().optional(),
            orderBy: z
                .tuple([sortFields, z.enum(['ASC', 'DESC', 'ASC NULLS LAST', 'DESC NULLS LAST'])])
                .optional()
                .nullable(),
            where: options?.filters?.filters ? recursiveFilterConditions(options?.filters?.filters).nullish() as unknown as z.ZodType<ActualFilters> : z.any() as never,
        }).partial();
    };
    const self = {
        getSelectableFields,
        getLoadArgs,
        getQuery,
        // By default, select all fields (string covers all), and don't exclude any fields
        async load<
            TSelect extends keyof (TVirtuals & z.infer<TObject>) = never,
            TExclude extends keyof (TVirtuals & z.infer<TObject>) = never
        >(
            args: LoadParameters<
                TFilter,
                z.infer<TContextZod>,
                TPostprocessed & TVirtuals & z.infer<TObject>,
                (TSelect | TRequired[number]) & TSelectable,
                TExclude,
                TSortable
            >, database?: Pick<CommonQueryMethods, "any">
        ) {
            const db = database || options?.db;
            if (!db?.any) throw new Error("Database not provided");
            const finalQuery = getQuery(args);
            return db.any(finalQuery).then(rows => {
                if (dataTransformers.length) {
                    return resolveTransformers(dataTransformers, rows);
                }
                return rows;
            });
        },
        /**
         * Returns the data in a pagination-convenient form.
         * Specify takeCount: true to query the overall count as if no limit had been specified.
         * Otherwise, count will be null.
         */
        async loadOffsetPagination<
            TSelect extends keyof (TVirtuals & z.infer<TObject>) = never,
            TExclude extends keyof (TVirtuals & z.infer<TObject>) = never
        >(
            args: LoadParameters<
                TFilter,
                z.infer<TContextZod>,
                TPostprocessed & TVirtuals & z.infer<TObject>,
                (TSelect | TRequired[number]) & TSelectable,
                TExclude,
                TSortable
            > & {
                takeCount?: boolean;
                takeNextPages?: number;
            }, database?: Pick<CommonQueryMethods, "any">
        ) {
            const db = database || options?.db;
            if (!db?.any) throw new Error("Database not provided");
            const extraItems = Math.max(Math.min(3, (args?.takeNextPages || 0) - 1), 0) * (args?.limit || 25) + 1;
            const finalQuery = getQuery({
                ...args,
                limit:
                    typeof args.limit === 'number'
                        ? // Query an extra row to see if the next page exists
                          Math.min(Math.max(0, args.limit), 1000) + extraItems
                        : undefined,
            });
            const countQuery = sql.type(countQueryType)`SELECT COUNT(*) FROM (${getQuery({
                ...args,
                limit: undefined,
            })}) allrows`;
            // Count is null by default
            let countPromise = Promise.resolve(null as number | null);
            if (args.takeCount) {
                countPromise = db
                    .any(countQuery)
                    .then((res) => res?.[0]?.count);
            }
            return db
                .any(finalQuery)
                .then(async (edges) => {
                    const slicedEdges = edges.slice(0, args.limit || undefined);
                    return {
                        edges: (dataTransformers.length ? await resolveTransformers(dataTransformers, slicedEdges) : slicedEdges),
                        hasNextPage: edges.length > slicedEdges.length,
                        minimumCount: (args.skip || 0) + edges.length,
                        hasPreviousPage: !!args.skip,
                        count: await countPromise.catch(err => console.error('Count query failed', err)),
                    };
                });
        },
    }
    return self;
}
