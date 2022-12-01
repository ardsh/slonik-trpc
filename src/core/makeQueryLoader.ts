import { sql, CommonQueryMethods, QuerySqlToken, SqlFragment, FragmentSqlToken } from "slonik";
import { z } from 'zod';
import { notEmpty } from "../helpers/zod";
import { RemoveAny } from '../helpers/types';
import { FilterOptions, Interpretors, makeFilter, RecursiveFilterConditions, recursiveFilterConditions, ZodPartial } from "./queryFilter";

const orderDirection = z.enum(["ASC", "DESC"]);
type OrderDirection = z.infer<typeof orderDirection>;
type OrderField = [string | [string, string] | [string, string, string] | FragmentSqlToken, z.infer<typeof orderDirection>];

function getOrderByDirection(field: OrderField, reverse?: boolean) {
    switch (field[1]) {
    case 'ASC': return reverse ? sql.fragment`DESC` : sql.fragment`ASC`;
    // case 'ASC NULLS LAST': return sql.fragment`ASC NULLS LAST`;
    case 'DESC': return reverse ? sql.fragment`ASC` : sql.fragment`DESC`;
    // case 'DESC NULLS LAST': return sql.fragment`DESC NULLS LAST`;
    }
}

function interpretFieldFragment(field: string | [string, string] | [string, string, string] | FragmentSqlToken): FragmentSqlToken {
    if (typeof field === 'string' || Array.isArray(field)) {
        return sql.fragment`${sql.identifier(Array.isArray(field) ? field : [field])}`;
    }
    return field;
}
function interpretOrderBy(field: OrderField, reverse?: boolean) {
    return sql.fragment`${interpretFieldFragment(field[0])} ${getOrderByDirection(field, reverse)}`;
}

type OptionalArray<T> = readonly T[] | T;

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
    /** The amount of rows to query. To page backwards, set take to a negative value */
    take?: number;
    /** Specify the count of items to skip, usually (currentPage - 1) * take */
    skip?: number;
    /**
     * Cursor-based pagination requires you to sort by a sequential, unique column such as an ID or a timestamp.
     * Use this parameter to pass the current item sortable values, after which you'd like to load.
     * E.g.
     * ```ts
     * searchAfter: {
     *     id: lastPageItemId
     * }
     * orderBy: [["id", "ASC"]]
     * ```
     * Or with multiple column sorting
     * ```ts
     * searchAfter: {
     *     createdAt: lastItemTimestamp,
     *     id: lastItemId,
     * },
     * orderBy: [["createdAt", "DESC"], ["id", "ASC"]]
     * ```
    */
    searchAfter?: {
        [x in TSortable]?: string | number | boolean | null
    },
    orderBy?: [TSortable] extends [never] ? never : OptionalArray<readonly [TSortable, 'ASC' | 'DESC']> | null;
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

function getSelectedKeys(allKeys: string[], selected?: readonly any[], excluded?: readonly any[], required?: readonly any[], defaultExcluded?: readonly string[]) {
    const noneSelected = !selected?.length;
    const noneExcluded = !excluded?.length;
    if (noneSelected && noneExcluded) {
        if (defaultExcluded?.length) {
            return allKeys.filter(key => !defaultExcluded.includes(key))
        } else {
            return allKeys;
        }
    }
    if (noneSelected && !noneExcluded) return allKeys.filter(key => !excluded.includes(key) || required?.includes(key));
    if (!noneSelected && noneExcluded) return allKeys.filter(key => selected.includes(key) || required?.includes(key));
    if (!noneSelected && !noneExcluded) return allKeys.filter(key => (!excluded.includes(key) && selected.includes(key)) || required?.includes(key));
    return allKeys;
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
    /**
     * You can use the {@link createFilters} helper for this argument.
     * Make sure the fields they reference are accessible from the main query
     * */
    filters?: {
        filters: TFilterTypes,
        interpreters: Interpretors<TFilterTypes, z.infer<TContextZod>>,
        options?: FilterOptions<TFilterTypes, z.infer<TContextZod>>
    }
    /**
     * Specify aliases for sortable columns. Can either be a single column, or a tuple of table name + column.
     * E.g.
     * ```ts
     * {
     *     createdDate: ["users", "created_at"],
     *     name: "fullName",
     * }
     * ```
    */
    sortableColumns?: {
        [key in TSortable]: string | [string, string] | [string, string, string] | FragmentSqlToken
    };
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
    const sortableAliases = Object.keys(options?.sortableColumns || {}) as [TSortable, ...TSortable[]];
    const sortFields = sortableAliases.length
            ? z.enum(sortableAliases)
            : // If unspecified, no field is allowed to be used for sorting
            (z.never() as never);
    const orderByWithoutTransform = z.tuple([sortFields, orderDirection]);
    const orderByType = z.tuple([sortFields.transform(field => options.sortableColumns?.[field] || field), orderDirection]);

    const mapTransformRows = async <T extends z.TypeOf<TObject>>(rows: readonly T[], select?: readonly string[], exclude?: readonly (string | number | symbol)[]): Promise<readonly T[]> => {
        if (!rows.length) return rows;
        if (options.virtualFields) {
            const keys = Object.keys(options.virtualFields);
            const selected = getSelectedKeys(keys, select, exclude, options.required, options.defaultExcludedColumns);
            if (selected.length) {
                await Promise.all(selected.map(async key => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const firstResolve = options.virtualFields![key]!.resolve(rows[0]);
                    if (typeof (firstResolve as PromiseLike<any>)?.then === 'function') {
                        await Promise.all(rows.slice(1).map(async (row: any) => {
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            row[key] = await options.virtualFields![key]!.resolve(row);
                        }));
                        (rows as any)[0][key] = await firstResolve;
                    } else {
                        (rows as any)[0][key] = firstResolve;
                        for (const row of rows.slice(1) as any[]) {
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            row[key] = options.virtualFields![key]!.resolve(row);
                        }
                    }
                }));
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return (options.postprocess ? await Promise.all(rows.map((row) => options.postprocess!(row))) as never : rows);
    }
    const getQuery = <
        TSelect extends keyof (TVirtuals & z.infer<TObject>) = string,
        TExclude extends keyof (TVirtuals & z.infer<TObject>) = never,//TDefaultExcluded[number], Shouldn't exclude defaults
    >({
        where,
        take,
        skip,
        orderBy,
        context,
        searchAfter,
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
        const reverse = !!take && take < 0;
        if (take && take < 0) take = -take;
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
        const orderExpressions = Array.isArray(orderBy?.[0]) ? orderBy?.map(order => orderByWithoutTransform.parse(order)) :
            orderBy?.length ? [orderByWithoutTransform.parse(orderBy)] : null;
        const conditions = [whereCondition].filter(notEmpty);
        if (searchAfter && orderExpressions?.length) {
            const orderByExpressions = orderExpressions.map(parsed => [interpretFieldFragment(orderByType.parse(parsed)[0]), parsed[1], parsed[0]] as const);
            conditions.push(
                sql.fragment`(${sql.join(
                orderByExpressions.map((_, outerIndex) => {
                    const expressions = orderByExpressions.slice(
                        0,
                        outerIndex + 1
                    );

                    return sql.fragment`(${sql.join(
                    expressions.map(([expression, direction, columnAlias], innerIndex) => {
                        let operator = sql.fragment`=`;
                        let nullFragment = sql.fragment`TRUE`;
                        const value = searchAfter[columnAlias];
                        if (innerIndex === expressions.length - 1) {
                            operator = direction === (reverse ? "DESC" : "ASC")
                                ? sql.fragment`>` : sql.fragment`<`;
                            if (value === null || value === undefined) {
                                nullFragment = sql.fragment`${expression} IS NULL`;
                            }
                        }
                        return value !== null && value !== undefined ? sql.fragment`${expression} ${operator} ${value}`
                            : nullFragment;
                    }), sql.fragment` AND `)})`;
                }),
                sql.fragment` OR `
                )})`
            );
        }
        const baseQuery = sql.type(zodType)`${query}
        ${conditions.length ? sql.fragment`WHERE (${sql.join(conditions, sql.fragment`) AND (`)})` : sql.fragment``}
        ${orderExpressions ? sql.fragment`ORDER BY ${sql.join(orderExpressions.map(parsed => interpretOrderBy(orderByType.parse(parsed), reverse)), sql.fragment`, `)}` : sql.fragment``}
        ${typeof take === 'number' ? sql.fragment`LIMIT ${take}` : sql.fragment``}
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
        TSort extends TSortable = TSortable,
    >(
        {
            sortableColumns = Object.keys(options?.sortableColumns || {}) as never,
            selectableColumns = options?.selectableColumns as never,
            transformSortColumns,
        }: {
            /** You can remove specific sortable columns to disallow sorting by them */
            sortableColumns?: [TSort, ...TSort[]];
            selectableColumns?: [TFields, ...TFields[]];
            transformSortColumns?: (columns?: Array<[TSort, OrderDirection]> | null) => Array<[TSort, OrderDirection]> | null | undefined
        } = {} as never
    ) => {
        const sortFields = sortableColumns?.length
            ? z.enum(sortableColumns)
            : // If unspecified, no field is allowed to be used for sorting
            (z.never() as never);
        const orderTuple = z.tuple([sortFields, orderDirection]);
        const selectColumns = (selectableColumns || options.selectableColumns);
        const fields = selectColumns?.length
            ? z.enum(selectColumns)
            : // If unspecified, any field is allowed to be selected
            (z.string() as never)
        const orderBy = z.preprocess(
            (a) => (Array.isArray(a) && Array.isArray(a[0]) ? a : [a].filter(notEmpty)),
            z.union([z.array(orderTuple), orderTuple]).optional()
        );
        type ActualFilters = RecursiveFilterConditions<
            z.infer<ZodPartial<TFilterTypes>>>;
        return z.object({
            /** The fields that should be included. If unspecified, all fields are returned. */
            select: z.array(fields).optional(),
            /** The fields that should be excluded. Takes precedence over `select`. */
            exclude: z.array(fields).optional(),
            take: z.number().optional(),
            skip: z.number().optional().default(0),
            takeCount: z.boolean().optional(),
            takeNextPages: z.number().optional(),
            searchAfter: z.object(sortableColumns.reduce((acc, column) => {
                acc[column] = z.any();
                return acc;
            }, {} as {
                [x in TSort]: z.ZodTypeAny
            })).partial().optional(),
            orderBy: typeof transformSortColumns === 'function' ? orderBy.transform(columns => {
                if (Array.isArray(columns)) {
                    if (Array.isArray(columns[0])) {
                        return transformSortColumns(columns as any) || columns
                    } else {
                        return transformSortColumns([columns] as any) || columns;
                    }
                }
                return columns;
            }) : orderBy,
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
            return db.any(finalQuery).then(async rows => {
                return mapTransformRows(rows, args.select, args.exclude);
            });
        },
        /**
         * Returns the data in a pagination-convenient form.
         * Specify takeCount: true to query the overall count as if no limit had been specified.
         * Otherwise, count will be null.
         */
        async loadPagination<
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
            const reverse = !!args.take && args.take < 0 ? -1 : 1;
            if (typeof args.take === 'number' && args.take < 0) args.take = -args.take;
            const extraItems = Math.max(Math.min(3, (args?.takeNextPages || 0) - 1), 0) * (args?.take || 25) + 1;
            const finalQuery = getQuery({
                ...args,
                take:
                    typeof args.take === 'number'
                        ? // Query an extra row to see if the next page exists
                          (Math.min(Math.max(0, args.take), 1000) + extraItems) * reverse
                        : undefined,
            });
            const countQuery = sql.type(countQueryType)`SELECT COUNT(*) FROM (${getQuery({
                ...args,
                take: undefined,
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
                    const slicedEdges = edges.slice(0, args.take || undefined);
                    return {
                        edges: await mapTransformRows(slicedEdges, args.select, args.exclude),
                        hasNextPage: edges.length > slicedEdges.length,
                        minimumCount: (args.skip || 0) + edges.length,
                        count: await countPromise.catch(err => console.error('Count query failed', err)),
                    };
                });
        },
    }
    return self;
}
