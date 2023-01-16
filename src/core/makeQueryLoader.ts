import { sql, CommonQueryMethods, QuerySqlToken, SqlFragment, FragmentSqlToken } from "slonik";
import { z } from 'zod';
import { notEmpty } from "../helpers/zod";
import { FilterOptions, Interpretors, makeFilter, RecursiveFilterConditions, recursiveFilterConditions, ZodPartial } from "./queryFilter";
import { debug } from '../helpers/debug';
import { fromCursor, toCursor } from "../helpers/cursors";

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
    TSortable extends string = never,
    TGroupSelectable extends string = never,
    TTakeCursors extends boolean = false,
> = {
    /** The fields that should be included. If `select` and `selectGroups` are unspecified, all fields are returned. */
    select?: readonly TSelect[];
    /** The amount of rows to query.
     * If take is a negative value, it will try to reverse the sort order and paginate backwards.
     * So
     * ```ts
     * take: -25,
     * orderBy: ["createdAt", "ASC"]
     * ```
     * Will be converted to
     * ```
     * take: 25,
     * orderBy: ["createdAt", "DESC"]
     * ```
     * automatically, and you'll get the last page's items.
     * Doesn't do anything if you don't specify orderBy though.
     * */
    take?: number;
    /** The amount of items to skip, usually (currentPage - 1) * take.
     * Used for offset-based pagination
     * */
    skip?: number;
    /**
     * Cursor-based pagination requires you to sort by a sequential, unique column such as an ID or a timestamp.
     * You can use this or `cursor` to pass the current item sortable values, after which you'd like to load.
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
     * searchAfter parameters will take precedence over `cursor`, if both are specified.
     * However this should be avoided, only use searchAfter if you'd like finer control over cursor-based pagination,
     * as it's generally harder to use than cursor.
     * */
    searchAfter?: {
        [x in TSortable]?: string | number | boolean | null
    },
    /**
     * If you specify the cursor string, it will act like an opaque searchAfter for searching after items.
     * Use in conjunction with takeCursors: true if you want an opaque implementation of cursor-based pagination.
     * Very useful especially if you have complex sorting requirements that don't match the returned fields.
     * Get the cursor from startCursor or endCursor from the loadPagination result, then use a positive or negative take.
     * */
    cursor?: string,
    /**
     * If specified true, a startCursor and endCursor is returned with loadPagination.
     * */
    takeCursors?: TTakeCursors,
    /** The `columnGroups` you want to select.
     * If `selectGroups` and `select` are unspecified, all columns will be selected.
     * If specified, will select the columns in that group.
     * E.g. if columnGroups are declared like this
     * ```ts
     * columnGroups: {
     *     basic: ["id", "name", "email"],
     * }
     * ```
     * You can specify
     * ```ts
     * selectGroups: ["basic"]
     * ```
     * To select all 3 columns
     * */
    selectGroups?: readonly TGroupSelectable[],
    /**
     * Specify the sorting order using sortable column aliases
     * The columns need to be allowed through the `sortableColumns` option
     * E.g.
     * ```ts
     * [["createdAt", "DESC"], ["id", "ASC"]]
     * ```
     * Or
     * ```ts
     * ["id", "ASC"]
     * ```
     * */
    orderBy?: OptionalArray<readonly [TSortable, 'ASC' | 'DESC']> | null;
    /* Pass the context that will be used for filters postprocessing and virtual field resolution */
    ctx?: TContext;
    where?: RecursiveFilterConditions<TFilter>;
};

export type ResultType<
    TObject extends z.AnyZodObject,
    TVirtuals extends Record<string, any>,
    TGroupSelected extends keyof (TVirtuals & z.infer<TObject>),
    TSelect extends keyof (TVirtuals & z.infer<TObject>),
> = Pick<
        TVirtuals & Omit<z.infer<TObject>, keyof TVirtuals>, // Virtual fields can overwrite real fields
        [TSelect] extends [never] ?
            [TGroupSelected] extends [never] ?
                keyof (TVirtuals & z.infer<TObject>) :
            (TGroupSelected ) :
        (TSelect  | TGroupSelected)
    >;

const countQueryType = z.object({
    count: z.number(),
});

function getSelectedKeys(allKeys: string[], selected?: readonly any[], excluded?: readonly any[]) {
    const noneSelected = !selected?.length;
    const noneExcluded = !excluded?.length;
    if (noneSelected && noneExcluded) {
        return allKeys;
    }
    if (noneSelected && !noneExcluded) return allKeys.filter(key => !excluded.includes(key));
    if (!noneSelected && noneExcluded) return allKeys.filter(key => selected.includes(key));
    if (!noneSelected && !noneExcluded) return allKeys.filter(key => (!excluded.includes(key) && selected.includes(key)));
    return allKeys;
}

export function makeQueryLoader<
    TContextZod extends z.ZodTypeAny,
    TFragment extends SqlFragment | QuerySqlToken,
    TFilterTypes extends Record<string, z.ZodTypeAny>=never,
    TObject extends z.AnyZodObject=TFragment extends QuerySqlToken<infer T> ? T : any,
    TVirtuals extends Record<string, any> = z.infer<TObject>,
    TSortable extends string = never,
    TGroups extends {
        [x: string]: readonly [Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>, ...(Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>)[]]
    } = Record<string, never>,
    TSelectable extends Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>
        = Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>,
>(options: {
    query: TFragment,
    /** Optional parameter that can be used to override the slonik query parser.
     * Doesn't need to be used if you use sql.type when declaring the query parameter.
     * */
    type?: TObject,
    /**
     * Optional parameter that can be used to verify the passed context.
     * Use this if you want to make sure the context always has a specific shape, e.g. when using it for authorization.
     * */
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
     * */
    sortableColumns?: {
        [key in TSortable]: string | [string, string] | [string, string, string] | FragmentSqlToken
    };
    /**
     * This option is convenient for fetching related columns together.
     * Column groups that are specified here can be fetched together with the `selectGroups` option when loading.
     * E.g.
     * ```ts
     * columnGroups: {
     *     basic: ["id", "name", "email"],
     * }
     * ```
     * Then when loading you can simply do
     * ```ts
     * selectGroups: ["basic"]
     * ```
     * To select all 3 columns.
     * */
    columnGroups?: TGroups,
    /**
     * You can narrow the types that are allowed to be selected with this option.
     * */
    selectableColumns?: readonly [TSelectable, ...TSelectable[]];
    /**
     * Specify a mapping of virtual fields, with their dependencies
     * */
    virtualFields?: {
        [x in keyof TVirtuals]?: {
            /** Return the virtual field */
            resolve: (row: z.infer<TObject>, ctx?: z.infer<TContextZod>) => PromiseLike<TVirtuals[x]> | TVirtuals[x];
            dependencies: readonly (keyof z.infer<TObject>)[];
        };
    };
    defaults?: {
        orderBy?: OptionalArray<readonly [TSortable, 'ASC' | 'DESC']> | null;
        /** The max limit when querying loadPagination. Can be increased from the default 1000 */
        maxLimit?: number
    };
}) {
    const query = options.query;
    if (query.sql.match(/;\s*$/)) {
        // TODO: Add more checks for invalid queries
        console.warn("Your query includes semicolons at the end. Please refer to the documentation of slonik-trpc, and do not include semicolons in the query:\n " + query.sql);
    }
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
    const cursorColumns = "cursorcolumns";
    const orderByType = z.tuple([sortFields.transform(field => options.sortableColumns?.[field] || field), orderDirection]);

    const mapTransformRows = async <T extends z.TypeOf<TObject>>(rows: readonly T[], select?: readonly string[], ctx?: z.infer<TContextZod>): Promise<readonly T[]> => {
        if (!rows.length) return rows;
        if (options.virtualFields) {
            const keys = Object.keys(options.virtualFields);
            const selected = getSelectedKeys(keys, select);
            if (selected.length) {
                await Promise.all(selected.map(async key => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const firstResolve = options.virtualFields![key]!.resolve(rows[0], ctx);
                    if (typeof (firstResolve as PromiseLike<any>)?.then === 'function') {
                        await Promise.all(rows.slice(1).map(async (row: any) => {
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            row[key] = await options.virtualFields![key]!.resolve(row, ctx);
                        }));
                        (rows as any)[0][key] = await firstResolve;
                    } else {
                        (rows as any)[0][key] = firstResolve;
                        for (const row of rows.slice(1) as any[]) {
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            row[key] = options.virtualFields![key]!.resolve(row, ctx);
                        }
                    }
                }));
            }
        }
        return rows;
    }
    const getQuery = <
        TSelect extends keyof (TVirtuals & z.infer<TObject>) = string,
        TGroupSelected extends Exclude<keyof TGroups, number | symbol> = never,
        TTakeCursors extends boolean = false,
    >({
        where,
        take,
        skip,
        orderBy=options?.defaults?.orderBy,
        ctx,
        cursor,
        takeCursors,
        searchAfter,
        selectGroups,
        select,
    }: LoadParameters<
        TFilter,
        z.infer<TContextZod>,
        TVirtuals & z.infer<TObject>,
        (TSelect) & TSelectable,
        TSortable,
        TGroupSelected,
        TTakeCursors
    >) => {
        const whereCondition = interpretFilters?.(where || ({} as any), ctx ? options.contextParser?.parse(ctx) ?? ctx : ctx);
        let actualQuery = query;
        if (selectGroups?.length) {
            const groupFields = selectGroups.flatMap(group => options.columnGroups?.[group] || []);
            select = (select || []).concat(...groupFields as any[]);
        }
        const isPartial = select?.length || selectGroups?.length;
        const reverse = !!take && take < 0;
        if (take && take < 0) take = -take;
        if (reverse && !orderBy?.length) {
            throw new Error("orderBy must be specified when take parameter is negative!");
        }
        const noneSelected = !select?.length;
        const orderExpressions = Array.isArray(orderBy?.[0]) ? orderBy?.map(order => orderByWithoutTransform.parse(order)) :
            orderBy?.length ? [orderByWithoutTransform.parse(orderBy)] : null;
        const conditions = [whereCondition].filter(notEmpty);
        const cursorsEnabled = takeCursors && orderExpressions?.length;
        const zodType: z.ZodType<ResultType<TObject, TVirtuals, TGroups[TGroupSelected][number], TSelect>>
            = cursorsEnabled ? (isPartial ? type.partial() : type).merge(z.object({
                [cursorColumns]: z.any(),
            })) : (isPartial ? type.partial() : type) as any;
        const fields = Object.keys(type?.keyof?.()?.Values || {}) as any[];
        const selectable = options?.selectableColumns;
        select = (select || [])
            .filter(field => !selectable?.length || selectable.indexOf(field) >= 0)
            // Add dependencies from selected fields.
            .flatMap((field) => [
                field,
                ...((options?.virtualFields?.[field]?.dependencies as any[]) || []),
            ])
            .filter((field) => !fields?.length || fields?.indexOf(field) >= 0);
        const finalKeys = Array.from(new Set(fields
            .filter(notEmpty)
            .filter((column) => noneSelected || select?.includes(column as any))
        ).values()).map(a => sql.identifier([a])) as any[];
        const lateralExpressions = [];
        if (takeCursors && orderExpressions?.length) {
            if (!query.sql.includes("lateralcolumns.cursorjson")) {
                // Hacky way to get access to internal FROM tables for sorting expressions...
                actualQuery = {
                    ...query,
                    sql: query.sql.replace(/^\n*(\W\n?)*SELECT/i, "SELECT lateralcolumns.cursorjson cursorcolumns, "),
                }
            }
            lateralExpressions.push(sql.fragment`json_build_object(${
                orderExpressions.length
                  ? sql.join(
                      orderExpressions.flatMap((expression) => [sql.literalValue(expression[0]), interpretFieldFragment(orderByType.parse(expression)[0])]),
                      sql.fragment`,`
                    )
                  : sql.fragment``
              }) cursorjson`);
        }
        if ((searchAfter || cursor) && orderExpressions?.length) {
            const orderByExpressions = orderExpressions.map(parsed => [interpretFieldFragment(orderByType.parse(parsed)[0]), parsed[1], parsed[0]] as const);
            const cursorValues = cursor ? fromCursor(cursor) : {} as never;
            if (Array.isArray(cursorValues)) {
                // Patching old array cursors...temporary only until next minor version
                cursorValues.forEach((value, idx) => {
                    cursorValues[orderExpressions[idx][0]] = value;
                });
            }
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
                        const value = searchAfter ? searchAfter[columnAlias] : cursorValues[columnAlias];
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
        const baseQuery = sql.type(zodType)`${actualQuery} ${lateralExpressions[0] ? sql.fragment`, LATERAL (SELECT ${sql.join(lateralExpressions, sql.fragment`, `)}) lateralcolumns` : sql.fragment``}
        ${conditions.length ? sql.fragment`WHERE (${sql.join(conditions, sql.fragment`) AND (`)})` : sql.fragment``}
        ${orderExpressions ? sql.fragment`ORDER BY ${sql.join(orderExpressions.map(parsed => interpretOrderBy(orderByType.parse(parsed), reverse)), sql.fragment`, `)}` : sql.fragment``}
        ${typeof take === 'number' ? sql.fragment`LIMIT ${take}` : sql.fragment``}
        ${typeof skip === 'number' ? sql.fragment`OFFSET ${skip}` : sql.fragment``}
        `;
        if (!select?.length && !selectGroups?.length) {
            finalKeys.push(sql.fragment`*`);
        }
        if (takeCursors && lateralExpressions?.length) {
            finalKeys.push(sql.identifier(["root_query", cursorColumns]));
        }

        // Run another root query, that only selects the column names that aren't excluded, or only ones that are included.
        const finalQuery = sql.type(zodType)`WITH root_query AS (${baseQuery})
            SELECT ${sql.join(
                finalKeys,
                sql.fragment`, `
            )} FROM root_query`;
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
        TFiltersDisabled extends Exclude<keyof TFilter, number | symbol> | "AND" | "OR" | "NOT" = never,
    >(
        {
            sortableColumns = Object.keys(options?.sortableColumns || {}) as never,
            selectableColumns = options?.selectableColumns as never,
            disabledFilters,
            transformSortColumns,
        }: {
            /** You can remove specific sortable columns to disallow sorting by them */
            sortableColumns?: [TSort, ...TSort[]];
            selectableColumns?: readonly [TFields, ...TFields[]];
            disabledFilters?: {
                [x in TFiltersDisabled]?: boolean
            },
            /**
             * You can enforce sorting constraints with this function.
             * E.g. ensure only certain columns are sortable, or with particular directions.
             * */
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
        type ColumnGroup = Exclude<keyof TGroups, number | symbol>;
        const groups = Object.keys(options.columnGroups || {}) as [ColumnGroup, ...ColumnGroup[]];
        const groupsEnum = groups.length ? z.enum(groups) : z.never() as never;
        const orderUnion = z.union([z.array(orderTuple), orderTuple]).nullish();
        const orderBy = z.preprocess(
            (typeof transformSortColumns === 'function' ? (columns => {
                if (Array.isArray(columns)) {
                    if (Array.isArray(columns[0]) || columns[0] === undefined) {
                        return transformSortColumns(columns as any) || columns
                    } else {
                        return transformSortColumns([columns].filter(notEmpty) as any) || columns;
                    }
                }
                return columns;
            }) : (a) => (Array.isArray(a) && (Array.isArray(a[0]) || a[0] === undefined) ? a : [a].filter(notEmpty))),
            orderUnion
        );
        type ActualFilters = [TFilterTypes] extends [never] ? never : RecursiveFilterConditions<
            z.infer<ZodPartial<TFilterTypes>>, TFiltersDisabled>;
        return z.object({
            /** The fields that should be included. If unspecified, all fields are returned. */
            select: z.array(fields).optional(),
            take: z.number().optional(),
            skip: z.number().optional().default(0),
            takeCount: z.boolean().optional(),
            takeCursors: z.boolean().optional(),
            cursor: z.string().optional(),
            takeNextPages: z.number().optional(),
            selectGroups: z.array(groupsEnum).optional(),
            searchAfter: sortableColumns.length ? z.object(sortableColumns.reduce((acc, column) => {
                acc[column] = z.any();
                return acc;
            }, {} as {
                [x in TSort]: z.ZodTypeAny
            })).partial().optional() : z.null() as never,
            orderBy: options?.defaults?.orderBy ?
                orderBy.default(options.defaults.orderBy) as never :
                orderBy as unknown as typeof orderUnion,
            where: options?.filters?.filters ? recursiveFilterConditions(options?.filters?.filters, disabledFilters).nullish() as unknown as z.ZodType<ActualFilters> : z.null() as never,
        }).partial();
    };
    const self = {
        _columnGroups: options.columnGroups,
        getSelectableFields,
        getLoadArgs,
        getQuery,
        // By default, select all fields (string covers all), and don't exclude any fields
        async load<
            TSelect extends keyof (TVirtuals & z.infer<TObject>) = never,
            TGroupSelected extends Exclude<keyof TGroups, number | symbol> = never,
        >(
            args: Omit<LoadParameters<
                TFilter,
                z.infer<TContextZod>,
                TVirtuals & z.infer<TObject>,
                (TSelect) & TSelectable,
                TSortable,
                TGroupSelected
            >, "takeCursors">, database?: Pick<CommonQueryMethods, "any">
        ) {
            // TODO: Remove this
            if (args.selectGroups?.length) {
                const groupFields = args.selectGroups.flatMap(group => options.columnGroups?.[group] || []);
                args.select = (args.select || []).concat(...groupFields as any[]);
            }
            const db = database || options?.db;
            const reverse = !!args.take && args.take < 0;
            if (!db?.any) throw new Error("Database not provided");
            const finalQuery = getQuery({
                ...args,
                takeCursors: false,
            });
            debug(finalQuery.sql);
            return db.any(finalQuery).then(async rows => {
                return mapTransformRows(reverse ? (rows as any).reverse() as never : rows, args.select, args.ctx);
            });
        },
        /**
         * Returns the data in a pagination-convenient form.
         * Specify takeCount: true to query the overall count as if no limit had been specified.
         * Otherwise, count will be null.
         * `take` is limited to 1000 items when using loadPagination, as it's meant to be used for loading only a few pages at a time.
         * */
        async loadPagination<
            TSelect extends keyof (TVirtuals & z.infer<TObject>) = never,
            TGroupSelected extends Exclude<keyof TGroups, number | symbol> = never,
            TTakeCursors extends boolean = false,
        >(
            args: LoadParameters<
                TFilter,
                z.infer<TContextZod>,
                TVirtuals & z.infer<TObject>,
                (TSelect) & TSelectable,
                TSortable,
                TGroupSelected,
                TTakeCursors
            > & {
                /**
                 * If true, a count query is called to fetch all the rows as if no `take` limit had been specified.
                 * And the `count` field will return a number.
                 * Otherwise `count` will be null.
                 * @default false
                 * */
                takeCount?: boolean;
                /**
                 * If you specify this parameter, N extra items will be fetched and minimumCount will be returned
                 * Useful if you want to know whether there are two next pages, simply specify
                 * ```ts
                 * take: 25,
                 * takeNextPages: 2
                 * ```
                 * Then minimumCount will be 51, if there are at least 1*25+1 items after the current one.
                 * @default 1
                 * @max 4
                 * */
                takeNextPages?: number;
            }, database?: Pick<CommonQueryMethods, "any">
        ) {
            if (args.selectGroups?.length) {
                const groupFields = args.selectGroups.flatMap(group => options.columnGroups?.[group] || []);
                args.select = (args.select || []).concat(...groupFields as any[]);
            }
            const db = database || options?.db;
            if (!db?.any) throw new Error("Database not provided");
            const reverse = !!args.take && args.take < 0 ? -1 : 1;
            const take = (typeof args.take === 'number' && args.take < 0) ? -args.take : args.take;
            if (reverse === -1 && !args.orderBy?.length) {
                throw new Error("orderBy must be specified when take parameter is negative!");
            }
            const extraItems = Math.max(Math.min(3, (args?.takeNextPages || 0) - 1), 0) * (take || 25) + 1;
            const finalQuery = getQuery({
                ...args,
                take: // Query an extra row to see if the next page exists
                      (Math.min(Math.max(0, take || 100), (options.defaults?.maxLimit || 1000)) + extraItems) * reverse,
            });
            const countQuery = sql.type(countQueryType)`SELECT COUNT(*) FROM (${getQuery({
                ...args,
                skip: undefined,
                searchAfter: undefined,
                cursor: undefined,
                takeCursors: false,
                take: undefined,
            })}) allrows`;
            // Count is null by default
            let countPromise = Promise.resolve(null as number | null);
            if (args.takeCount) {
                debug(countQuery.sql);
                countPromise = db
                    .any(countQuery)
                    .then((res) => res?.[0]?.count);
            }
            debug(finalQuery.sql);
            return db
                .any(finalQuery)
                .then(async (edges) => {
                    const slicedEdges = edges.slice(0, take || undefined);
                    const rows = reverse === -1 ? slicedEdges.reverse() as never : slicedEdges;
                    const cursors = args.takeCursors && {
                        startCursor: toCursor((rows[0] as any)?.[cursorColumns]),
                        endCursor: toCursor((rows[rows.length - 1] as any)?.[cursorColumns]),
                        cursors: rows.map((row: any) => {
                            if (row[cursorColumns]) {
                                const { cursorcolumns } = row;
                                delete row[cursorColumns];
                                return toCursor(cursorcolumns);
                            }
                            return null;
                        }),
                    };
                    const hasMore = edges.length > slicedEdges.length;
                    const hasPrevious = !!args.skip || (!!args.cursor || !!args.searchAfter);
                    return {
                        edges: await mapTransformRows(rows, args.select, args.ctx),
                        ...(cursors && {
                            cursors: cursors.cursors
                        }),
                        pageInfo: {
                            hasPreviousPage: reverse === -1 ? hasMore : hasPrevious,
                            hasNextPage: reverse === -1 ? hasPrevious : hasMore,
                            minimumCount: (args.skip || 0) + edges.length,
                            ...(cursors && {
                                startCursor: cursors.startCursor,
                                endCursor: cursors.endCursor,
                            }),
                            count: await countPromise.catch(err => console.error('Count query failed', err)),
                        }
                    };
                });
        },
    }
    return self;
}

export type InferPayload<
    TLoader extends {
        load: (...args: any) => any
    },
    TArgs extends TLoader extends {
        loadPagination: (...args: readonly [infer A]) => any
    } ? Omit<A, "ctx" | "orderBy" | "searchAfter" | "skip" | "take" | "takeCount" | "takeNextPages" | "where" | "cursor"> : never = never,
    TResult extends Record<string, any> = TLoader extends {
        load: (...args: any) => PromiseLike<ArrayLike<infer A>>
    } ? A extends Record<string, any> ? Exclude<A, "cursor"> : never : any,
    TSelect extends Exclude<keyof TResult, number | symbol> = TArgs extends {
        select: ArrayLike<infer A>
    } ? A extends Exclude<keyof TResult, number | symbol> ? A : never : never,
    TGroups extends {
        [x: string]: ArrayLike<Exclude<keyof TResult, number | symbol>>
    } = TLoader extends {
        _columnGroups: infer A
    } ? A extends { [x: string]: ArrayLike<Exclude<keyof TResult, number | symbol>> } ? A : never : never,
    TGroupSelected extends keyof TGroups = TArgs extends {
        selectGroups: ArrayLike<infer A>
    } ? A extends keyof TGroups ? A : never : never,
> = Pick<
    TResult,
    [TSelect] extends [never] ?
        [TGroupSelected] extends [never] ?
            keyof TResult :
        (TGroups[TGroupSelected][number]) :
    (TSelect | TGroups[TGroupSelected][number])
>;

type Mutable<T> = T & {
    -readonly[P in keyof T]: Mutable<T[P]>
};

export type InferArgs<
    TLoader extends {
        load: (...args: any) => any
    },
    TArgs = TLoader extends {
        loadPagination: (...args: readonly [infer A]) => any
    } ? A : any,
> = Mutable<Omit<TArgs, "ctx">>;

