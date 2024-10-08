import { sql, CommonQueryMethods, QuerySqlToken, SqlFragment, FragmentSqlToken } from "slonik";
import { z } from 'zod';
import { notEmpty } from "../helpers/zod";
import { FilterOptions, Interpretors, RecursiveFilterConditions } from "./queryFilter";
import { fromCursor, toCursor } from "../helpers/cursors";
import type { Plugin } from "./plugins/types";
import { PromiseOrValue } from "../helpers/types";
import { buildView, BuildView } from "./buildView";

const orderDirection = z.enum(["ASC", "DESC"]);
type OrderDirection = z.infer<typeof orderDirection>;
type SortField = string | [string, string] | [string, string, string] | FragmentSqlToken | {
    field: FragmentSqlToken,
    nullsLast?: boolean,
    nullable?: boolean,
};
type OrderField = [SortField, z.infer<typeof orderDirection>];

function isBasicSortFieldOption(field?: SortField): field is string | [string, string] | [string, string, string] | FragmentSqlToken {
    return !(field as { field: FragmentSqlToken })?.field?.sql;
}

function getOrderFieldNullsLast(field?: SortField) {
    return isBasicSortFieldOption(field) ? false : !!field?.nullsLast;
}

function getOrderFieldNullable(field?: SortField) {
    return isBasicSortFieldOption(field) ? false : !!field?.nullable;
}

function getOrderByDirection(field: OrderField, reverse?: boolean) {
    if (getOrderFieldNullsLast(field[0])) {
        switch (field[1]) {
        case 'ASC': return reverse ? sql.fragment`DESC NULLS FIRST` : sql.fragment`ASC NULLS LAST`;
        case 'DESC': return reverse ? sql.fragment`ASC NULLS FIRST` : sql.fragment`DESC NULLS LAST`;
        }
    }
    switch (field[1]) {
    case 'ASC': return reverse ? sql.fragment`DESC` : sql.fragment`ASC`;
    case 'DESC': return reverse ? sql.fragment`ASC` : sql.fragment`DESC`;
    }
}

function interpretFieldFragment(field: SortField): FragmentSqlToken {
    if (typeof field === 'string' || Array.isArray(field)) {
        return sql.fragment`${sql.identifier(Array.isArray(field) ? field : [field])}`;
    }
    return isBasicSortFieldOption(field) ? field : field.field;
}
function interpretOrderBy(field: OrderField, reverse?: boolean) {
    return sql.fragment`${interpretFieldFragment(field[0])} ${getOrderByDirection(field, reverse)}`;
}

type OptionalArray<T> = readonly T[] | T;

// Need to pick used keys explicitly, omitting doesn't work
type GetNonEmptyKeys<TFilter extends Record<string, z.ZodTypeAny>=never, TSortable extends string=never> =
    ([TFilter] extends [never] ? "take" : [keyof TFilter] extends [never] ? "take" : "where") |
    ([TSortable] extends [never] ? "take" : ("orderBy" | "searchAfter" | "takeCursors" | "cursor" | "distinctOn")) |
    "take" | "skip" | "select" | "ctx" | "selectGroups";

export type LoadParameters<
    TFilter,
    TContext,
    TObject extends Record<string, any>,
    TSelect extends keyof TObject,
    TSortable extends string = never,
    TGroupSelectable extends string = never,
    TTakeCursors extends boolean = false,
    TDisabledFilters extends "AND" | "OR" | "NOT"=never,
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
    orderBy?: OptionalArray<readonly [TSortable, 'ASC' | 'DESC' | 'ASC NULLS LAST' | 'DESC NULLS LAST']> | null;
    /** The DISTINCT ON part of the query.
     * If not null, it will automatically reorder the orderBy fragments, to put distinct fields in front of orderBy.
     * If the fields aren't specified in orderBy, they will be added in front, with ascending order.
     *
     * Use this with postgres only to select distinct rows based on a column.
     * E.g.
     * ```ts
     * distinctOn: ["id"]
     * ```
     * Will generate
     * ```sql
     * SELECT DISTINCT ON ("id") * FROM ...
     * ```
     * 
     * If specified `true`, only distinct rows are returned `SELECT DISTINCT`
     * */
    distinctOn?: OptionalArray<TSortable> | null;
    /* Pass the context that will be used for filters postprocessing and virtual field resolution */
    ctx?: TContext;
    where?: RecursiveFilterConditions<TFilter, TDisabledFilters>;
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


function getSelectedKeys(allKeys: string[], selected?: readonly any[]) {
    const noneSelected = !selected?.length;
    if (!noneSelected) {
        return allKeys.filter(key => selected.includes(key));
    } else {
        return allKeys;
    }
}

export function makeQueryLoader<
    TContextZod extends z.ZodTypeAny,
    TFragment extends SqlFragment | QuerySqlToken,
    TView extends BuildView,
    TManualFilterTypes extends Record<string, any>=never,
    TFilterTypes extends Record<string, any>=TView extends BuildView<infer T> ?
        [TManualFilterTypes] extends [never] ? T : T & TManualFilterTypes :
        TManualFilterTypes,
    TObject extends z.AnyZodObject=TFragment extends QuerySqlToken<infer T> ? T : any,
    TVirtuals extends Record<string, any> = z.infer<TObject>,
    TSortable extends string = never,
    TGroups extends {
        [x: string]: readonly [Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>, ...(Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>)[]]
    } = Record<string, never>,
    TSelectable extends Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>
        = Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>,
    TContext=z.infer<TContextZod>,
    TFilterOrEnabled extends boolean = false,
    TSortableDefault extends TSortable = TSortable,
>(options: {
    query: {
        /** The select query (without including FROM) */
        select: TFragment,
        /** The FROM part of the query. Should start with `FROM` */
        from?: SqlFragment,
        /** The view from buildView utility. Used to provide filters and the FROM clause. */
        view?: TView,
        /** The GROUP BY part of the query. Don't include `GROUP BY` */
        groupBy?: SqlFragment | ((args: LoadParameters<
            Partial<TFilterTypes>,
            TContext,
            TVirtuals & z.infer<TObject>,
            (keyof (TVirtuals & z.infer<TObject>)) & TSelectable,
            TSortable,
            Exclude<keyof TGroups, number | symbol>,
            boolean,
            TFilterOrEnabled extends true ? never : "OR"
        >) => SqlFragment),
    },
    plugins?: readonly Plugin<any>[],
    /** Optional parameter that can be used to override the slonik query parser.
     * Doesn't need to be used if you use sql.type when declaring the query parameter.
     * */
    type?: TObject,
    /**
     * Optional parameter that can be used to verify the passed context.
     * Use this if you want to make sure the context always has a specific shape, e.g. when using it for authorization.
     * */
    contextParser?: TContextZod,
    /**
     * Optional function that can be used to create the context.
     * Use this if you want to add default values to every context.
     * */
    contextFactory?: (userContext?: z.infer<TContextZod>) => TContext,
    db?: Pick<CommonQueryMethods, "any">
    /**
     * DEPRECATED: Use `view` instead.
     * You can use the {@link buildView} to build relations with their own filters.
     * */
    filters?: {
        filters: TManualFilterTypes,
        interpreters: Interpretors<TManualFilterTypes, TContext>,
        options?: FilterOptions<TManualFilterTypes, TContext>
    }
    /**
     * You can add any hardcoded conditions here, to be used for authorization.  
     * Any conditions you return will be appended to the overall AND conditions, and cannot be bypassed.
     * 
     * E.g.
     * 
     * ```ts
     * constraints(ctx) {
     *   if (!ctx.userId) return sql.fragment`FALSE`; // Disable querying for unknown users.
     * 
     *   return sql.fragment`posts.author=${ctx.userId}`;
     * }
     * ```
     * 
     * This will let users query only their own posts, if the posts table is in the query.
     * */
    constraints?: (ctx: TContext) => PromiseOrValue<SqlFragment | SqlFragment[] | null | undefined>,
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
        [key in TSortable]: SortField
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
            /**
             * Use this to load data more efficiently in batches.
             * The resolver function has access to the result of this function
             * */
            load?: (
                rows: readonly z.infer<TObject>[],
                args: LoadParameters<
                    TFilterTypes,
                    TContext,
                    z.infer<TObject>,
                    keyof z.infer<TObject> & TSelectable,
                    TSortable,
                    Exclude<keyof TGroups, number | symbol>,
                    boolean,
                    TFilterOrEnabled extends true ? never : 'OR'
                >,
            ) => any,
            /** Return the virtual field */
            resolve: (row: z.infer<TObject>, args: LoadParameters<
                TFilterTypes,
                z.infer<TContextZod>,
                z.infer<TObject>,
                (keyof (z.infer<TObject>)) & TSelectable,
                TSortable,
                Exclude<keyof TGroups, number | symbol>,
                boolean,
                TFilterOrEnabled extends true ? never : "OR"
            > & { index: number },
                remoteLoadResult?: any
            ) => PromiseLike<TVirtuals[x]> | TVirtuals[x];
            dependencies: readonly (keyof z.infer<TObject>)[];
        };
    };
    options?: {
        /**
         * OR filters are disabled by default.
         * Specify true to enable them.
         * */
        orFilterEnabled?: TFilterOrEnabled,
        /**
         * This allows you to transform the column names of the selected object, before they're used to create the SQL query.
         * Useful if you've got a [slonik interceptor for camelCase columns.](https://github.com/gajus/slonik-interceptor-field-name-transformation)
         * 
         * So in case you have a interceptor that converts snake case to camelCase, you have to do the reverse here, like this:
         * 
         * ```
         * import { snakeCase } from 'changeCase';
         * transformColumns: (field) => snakeCase(field)
         * ```
         * 
         * By converting a camelCase back to snake_case you ensure the SQL query will be correct.
         * You can also use an object map if you need, or some other method.
         * This is mostly to be used as an escape hatch for slonik interceptors that transform rows.
         * */
        transformColumns?: (column: TSelectable) => string,
        /**
         * EXPERIMENTAL SUPPORT
         * 
         * If specified true, the engine will try to use SQLite syntax instead of PostgreSQL syntax.
         * */
        useSqlite?: boolean
        /** The max limit when querying loadPagination. Can be increased from the default 1000 */
        maxLimit?: number
        /** Whether you want to run the specified zod parser for the returned rows.
         * Used in `loadPagination` and `load`.
         * 
         * NOTE: This can affect performance negatively, depending on the parser you use, and is unnecessary if you're using zod parsing in slonik's interceptor
         * @default false
         * */
        runtimeCheck?: boolean
        /** Used when calculating virtual fields that return promises.
         * 50 by default, lower this if you don't want your rows virtual fields to be processed all at once
         * */
        runConcurrency?: number
    },
    defaults?: {
        orderBy?: OptionalArray<readonly [TSortableDefault, 'ASC' | 'DESC' | 'ASC NULLS LAST' | 'DESC NULLS LAST']> | null;
        take?: number;
    };
}) {
    type TDisabledFilters = TFilterOrEnabled extends true ? never : "OR";
    const queryComponents = options.query;
    const query = queryComponents.select;
    let view = queryComponents.view;
    const fromFragment = queryComponents.from || view?.getFromFragment({});
    if (options.filters?.interpreters && !view && fromFragment) {
        // backwards compatible if only filters are specified
        view = buildView`${fromFragment}`
            .addFilters(options.filters.interpreters as any) as any;
    } else if (options.filters?.interpreters && view) {
        // Add filters to existing view if both are specified
        view = view.addFilters(options.filters.interpreters as any) as any;
    }
    if (query.sql.match(/;\s*$/)) {
        // TODO: Add more checks for invalid queries
        console.warn("Your query includes semicolons at the end. Please refer to the documentation of slonik-trpc, and do not include semicolons in the query:\n " + query.sql);
    }
    if (!fromFragment) {
        console.warn("Deprecation warning: Specify query.from and query.select separately in makeQueryLoader", query?.sql);
    }
    if (fromFragment && fromFragment.sql?.length > 5 && !fromFragment?.sql?.match?.(/^\s*FROM/i)) {
        throw new Error("query.from must begin with FROM");
    }
    if (!query?.sql?.match?.(/^\s*(SELECT|WITH)/i)) {
        throw new Error("Your query must begin with SELECT or WITH");
    }
    const type = options.type || (query as QuerySqlToken).parser as z.AnyZodObject;
    // @ts-expect-error accessing internal _any
    const isAnyType = type._any === true;
    if (!isAnyType && (!type || !type.keyof || !type.partial)) throw new Error('Invalid query type provided: ' + (type));
    type TFilter = {
        [x in keyof TFilterTypes]?: TFilterTypes[x] extends z.ZodTypeAny ? z.infer<TFilterTypes[x]> : TFilterTypes[x]
    }
    const interpretFilters = view ? view.getWhereConditions : null;
    const sortableAliases = Object.keys(options?.sortableColumns || {}) as [TSortable, ...TSortable[]];
    const sortFields = sortableAliases.length
            ? z.enum(sortableAliases)
            : // If unspecified, no field is allowed to be used for sorting
            (z.never() as never);
    const orderByWithoutTransform = z.tuple([sortFields, orderDirection]);
    const cursorColumns = "cursorcolumns";
    const sortFieldWithTransform = sortFields.transform(field => {
        return options.sortableColumns?.[field] || field;
    });
    const orderByType = z.tuple([sortFieldWithTransform, orderDirection]);

    const mapTransformRows = async <T extends z.TypeOf<TObject>>(rows: readonly T[], args: LoadParameters<
        TFilterTypes,
        TContext,
        TVirtuals & z.infer<TObject>,
        (keyof (TVirtuals & z.infer<TObject>)) & TSelectable,
        TSortable,
        Exclude<keyof TGroups, number | symbol>,
        boolean,
        TDisabledFilters
    >): Promise<readonly T[]> => {
        if (!rows.length) return rows;
        if (options.virtualFields) {
            const keys = Object.keys(options.virtualFields);
            const selected = getSelectedKeys(keys, args.select);
            if (selected.length) {
                const { default: Nativebird } = await import('nativebird');
                await Promise.all(selected.map(async key => {
                    const remoteLoad = await options.virtualFields?.[key]?.load?.(rows, args);
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const firstResolve = options.virtualFields![key]!.resolve(rows[0], {
                        ...args,
                        index: 0,
                    }, remoteLoad);
                    if (typeof (firstResolve as PromiseLike<any>)?.then === 'function') {
                        await Nativebird.map(rows.slice(1), async (row: any, index) => {
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            row[key] = await options.virtualFields![key]!.resolve(row, {
                                ...args,
                                index,
                            }, remoteLoad);
                        }, { concurrency: options?.options?.runConcurrency || 50 });
                        (rows as any)[0][key] = await firstResolve;
                    } else {
                        (rows as any)[0][key] = firstResolve;
                        let index = 0;
                        for (const row of rows.slice(1) as any[]) {
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            row[key] = options.virtualFields![key]!.resolve(row, {
                                ...args,
                                index: ++index,
                            }, remoteLoad);
                        }
                    }
                }));
            }
        }
        if (options?.options?.runtimeCheck) {
            const zodType = type.partial();
            return rows.map(row => zodType.parse(row)) as never;
        } else {
            return rows;
        }
    }
    const getQuery = async <
        TSelect extends keyof (TVirtuals & z.infer<TObject>) = string,
        TGroupSelected extends Exclude<keyof TGroups, number | symbol> = never,
        TTakeCursors extends boolean = false,
    >(allArgs: LoadParameters<
        TFilter,
        z.infer<TContextZod>,
        TVirtuals & z.infer<TObject>,
        (TSelect) & TSelectable,
        TSortable,
        TGroupSelected,
        TTakeCursors,
        TDisabledFilters
    >) => {
        let {
            take,
            select,
            orderBy,
        } = allArgs;
        const {
            where,
            skip,
            distinctOn,
            ctx,
            cursor,
            takeCursors,
            searchAfter,
            selectGroups,
        } = allArgs;
        const context = ctx && options.contextParser?.parse ? options.contextParser.parse(ctx) : ctx;
        const filtersCondition = await interpretFilters?.({
            where: where || ({} as any),
            ctx: context,
            options: {
                orEnabled: !!options?.options?.orFilterEnabled,
            }
        });
        // Allows easier usage of cursor pagination with default sorting
        if (!orderBy?.length && options.defaults?.orderBy?.length) {
            orderBy = options.defaults.orderBy;
        }
        const authConditions = await options?.constraints?.(context);
        const auth = Array.isArray(authConditions) ? authConditions : [authConditions].filter(notEmpty);
        const allConditions = [...auth, ...(filtersCondition || [])].filter(notEmpty);
        const whereCondition = allConditions.length ? sql.fragment`(${sql.join(
            allConditions,
            sql.fragment`) AND (`
        )})` : sql.fragment`TRUE`;
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
        const distinctFields = Array.isArray(distinctOn) ? distinctOn?.map(distinct => sortFields.parse(distinct)) :
            distinctOn?.length ? [sortFields.parse(distinctOn)] : null;
        const orderExpressions = Array.isArray(orderBy?.[0]) ? orderBy?.map(order => orderByWithoutTransform.parse(order)) :
            orderBy?.length ? [orderByWithoutTransform.parse(orderBy)] : distinctFields?.length ? [] : null;
        if (distinctFields?.length && !options?.options?.useSqlite) {
            const distinctExpressions = distinctFields.map(field => interpretFieldFragment(sortFieldWithTransform.parse(field)));
            const distinctQuery = sql.fragment`SELECT DISTINCT ON (${sql.join(distinctExpressions, sql.fragment`, `)})`;
            // Hacky way to add DISTINCT ON (must be done towards the end...)
            actualQuery = {
                ...actualQuery,
                sql: query.sql.replace(/^\n*(\W\n?)*SELECT(\s*DISTINCT)?/i, distinctQuery.sql),
            };
            for (const expression of distinctFields.reverse()) {
                // Reverse to make sure unshift is done in the correct order
                const orderPosition = orderExpressions?.findIndex(([field]) => field === expression);
                if (typeof orderPosition === 'number' && orderPosition >= 0) {
                    orderExpressions?.unshift(orderExpressions?.splice(orderPosition, 1)?.[0]);
                } else {
                    orderExpressions?.unshift([expression, 'ASC']);
                }
            }
        }
        const conditions = [whereCondition].filter(notEmpty);
        const cursorsEnabled = takeCursors && orderExpressions?.length;
        const zodType: z.ZodType<ResultType<TObject, TVirtuals, TGroups[TGroupSelected][number], TSelect>>
            = isAnyType ? type : cursorsEnabled ? (isPartial ? type.partial() : type).merge(z.object({
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
        const hasTransformColumns = typeof options?.options?.transformColumns === 'function';
        if (hasTransformColumns) {
            select = select.map((field) => options?.options?.transformColumns?.(field) ?? field) as any[];
        }
        const sqlFields = hasTransformColumns ? fields.map(field => options?.options?.transformColumns?.(field) ?? field) : fields;
        const finalKeys = Array.from(new Set(sqlFields
            .filter(notEmpty)
            .filter((column) => noneSelected || select?.includes(column as any))
        ).values()).map(a => sql.identifier([a])) as any[];
        const lateralExpressions = [] as SqlFragment[];
        const extraSelects = [] as SqlFragment[];
        if (takeCursors && orderExpressions?.length) {
            if (options.options?.useSqlite) {
                finalKeys.push(sql.fragment`json_object(${
                    orderExpressions.length
                      ? sql.join(
                          orderExpressions.flatMap((expression) => [sql.literalValue(expression[0]), interpretFieldFragment(orderByType.parse(expression)[0])]),
                          sql.fragment`,`
                        )
                      : sql.fragment``
                  }) ${sql.identifier([cursorColumns])}`);
            } else {
                if (!query.sql.includes("lateralcolumns.cursorjson")) {
                    // Hacky way to get access to internal FROM tables for sorting expressions...
                    extraSelects.push(sql.fragment`lateralcolumns.cursorjson ${sql.identifier([cursorColumns])}`)
                }
                lateralExpressions.push(sql.fragment`jsonb_build_object(${
                    orderExpressions.length
                      ? sql.join(
                          orderExpressions.flatMap((expression) => [sql.literalValue(expression[0]), interpretFieldFragment(orderByType.parse(expression)[0])]),
                          sql.fragment`,`
                        )
                      : sql.fragment``
                  }) cursorjson`);
            }
        }
        if ((searchAfter || cursor) && orderExpressions?.length) {
            const orderByExpressions = orderExpressions.map(parsed => [interpretFieldFragment(orderByType.parse(parsed)[0]), parsed[1], parsed[0], parsed] as const);
            const cursorValues = cursor ? fromCursor(cursor) : {} as never;
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
                        const orderField = options.sortableColumns?.[columnAlias];
                        const value = searchAfter ? searchAfter[columnAlias] : cursorValues[columnAlias];
                        const isNullable = getOrderFieldNullable(orderField) || value === null;
                        const nullsLast = getOrderFieldNullsLast(orderField);
                        let isNull = false;
                        const ascending = direction === (reverse ? "DESC" : "ASC")
                        if (innerIndex === expressions.length - 1) {
                            operator = ascending ? sql.fragment`>` : sql.fragment`<`;
                            if (isNullable) {
                                nullFragment = ascending || nullsLast ? sql.fragment`${expression} IS NULL`
                                    : sql.fragment`${expression} IS NOT NULL`;
                                isNull = ascending || nullsLast;
                            }
                        } else if (value === null) {
                            nullFragment = ascending !== nullsLast ? sql.fragment`${expression} IS NOT NULL`
                                : sql.fragment`${expression} IS NULL`;
                            isNull = ascending === nullsLast;
                        }
                        return value !== null && value !== undefined ?
                            isNullable && isNull ? sql.fragment`(${expression} ${operator} ${value} OR ${nullFragment})`
                                : sql.fragment`${expression} ${operator} ${value}`
                            : nullFragment;
                    }), sql.fragment` AND `)})`;
                }),
                sql.fragment` OR `
                )})`
            );
        }
        const groupExpression = (queryComponents.groupBy) ? [
            ...(typeof queryComponents.groupBy === 'function' ? [queryComponents.groupBy(allArgs)] : []),
            ...((queryComponents.groupBy as SqlFragment)?.sql ? [queryComponents.groupBy as SqlFragment] : []),
            lateralExpressions[0] ? sql.fragment`lateralcolumns.cursorjson` : null
        ].filter(notEmpty) : [];
        const extraSelectFields = extraSelects.length ? sql.fragment`, ${sql.join(extraSelects, sql.fragment`, `)}` : sql.fragment``;
        const realFromFragment = view ? view.getFromFragment(context) : fromFragment;

        const baseQuery = sql.type(zodType)`${actualQuery} ${extraSelectFields} ${realFromFragment ?? sql.fragment``} ${lateralExpressions[0] ? sql.fragment`, LATERAL (SELECT ${sql.join(lateralExpressions, sql.fragment`, `)}) lateralcolumns` : sql.fragment``}
        ${conditions.length ? sql.fragment`WHERE (${sql.join(conditions, sql.fragment`)\n  AND (`)})` : sql.fragment``}
        ${groupExpression?.length ? sql.fragment`GROUP BY ${sql.join(groupExpression, sql.fragment`, `)}` : sql.fragment``}
        ${orderExpressions ? sql.fragment`ORDER BY ${sql.join(orderExpressions.map(parsed => interpretOrderBy(orderByType.parse(parsed), reverse)), sql.fragment`, `)}` : sql.fragment``}
        ${typeof take === 'number' ? sql.fragment`LIMIT ${take}` : sql.fragment``}
        ${typeof skip === 'number' ? sql.fragment`OFFSET ${skip}` : sql.fragment``}
        `;
        if (!select?.length && !selectGroups?.length && !fields.length) {
            finalKeys.push(sql.fragment`*`);
        } else if (takeCursors && lateralExpressions?.length) {
            finalKeys.push(sql.identifier(["root_query", cursorColumns]));
        }

        // Run another root query, that only selects the column names that aren't excluded, or only ones that are included.
        const finalQuery = sql.type(zodType)`WITH root_query AS (${baseQuery})
            SELECT ${sql.join(
                finalKeys,
                sql.fragment`, `
            )} FROM root_query`;
        for (const plugin of (options.plugins || [])) {
            if (plugin.onGetQuery) {
                plugin.onGetQuery({
                    args: {
                        ...allArgs,
                        take,
                        select,
                    },
                    query: finalQuery,
                });
            }
        }
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
        TFiltersDisabled extends {
            AND?: boolean,
            OR?: boolean,
            NOT?: boolean,
        } = never,
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
            disabledFilters?: TFiltersDisabled,
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
            }) : (a) => (Array.isArray(a) && (Array.isArray(a[0]) || a[0] === undefined) ? a : [a].filter(notEmpty))),
            orderUnion
        );
        type ActualFilters = [TFilterTypes] extends [never] ? never :
            [keyof TFilterTypes] extends [never] ? never :
        RecursiveFilterConditions<TFilter, Extract<keyof TFiltersDisabled, "AND" | "OR" | "NOT"> | TDisabledFilters>;

        const filterKeys = Object.keys(options.query.view?.getFilters() || {})
            .concat(Object.keys(options?.filters?.filters || {}))
        const hasFilters = !!filterKeys.length;
        const filterType: any = z.lazy(() =>
            z.object({
                ...(filterKeys.reduce((acc, key) => {
                    acc[key] = options?.filters?.filters?.[key] || z.any();
                    return acc;
                }, {} as Record<string, any>)),
                ...(hasFilters && !disabledFilters?.OR && options?.options?.orFilterEnabled && { OR: z.array(filterType) }),
                ...(hasFilters && !disabledFilters?.AND && { AND: z.array(filterType) }),
                ...(hasFilters && !disabledFilters?.NOT && { NOT: filterType }),
            }).partial()
        ).nullish();

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
            where: filterType as z.ZodType<ActualFilters>,
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
            args: Pick<LoadParameters<
                TFilter,
                z.infer<TContextZod>,
                TVirtuals & z.infer<TObject>,
                (TSelect) & TSelectable,
                TSortable,
                TGroupSelected,
                false,
                TDisabledFilters
            >, Exclude<GetNonEmptyKeys<TFilterTypes, TSortable>, "takeCursors">>, database?: Pick<CommonQueryMethods, "any">
        ) {
            if (args.selectGroups?.length) {
                const groupFields = args.selectGroups.flatMap(group => options.columnGroups?.[group] || []);
                args.select = (args.select || []).concat(...groupFields as any[]);
            }
            if (typeof options.contextFactory === 'function') {
                args.ctx = options.contextFactory(args.ctx);
            }
            const db = database || options?.db;
            const reverse = !!args.take && args.take < 0;
            if (!db?.any) throw new Error("Database not provided");
            const finalQuery = await getQuery({
                ...args,
                take: typeof args.take === 'number' ? args.take : (options?.defaults?.take),
                takeCursors: false,
            });
            let result = null as PromiseOrValue<TObject[]> | null;
            const onLoadOptions = {
                args,
                query: finalQuery,
                setResultAndStopExecution(newResult: PromiseOrValue<TObject[]>) {
                    result = newResult;
                },
            }
            const afterCalls: ((options: { result: readonly any[]; setResult: (newResult: PromiseOrValue<TObject[]>) => void }) => void)[] = [];

            for (const plugin of options.plugins || []) {
                if (plugin.onLoad) {
                    const done = plugin.onLoad(onLoadOptions);
                    if (done?.onLoadDone) {
                        afterCalls.push(done.onLoadDone);
                    }
                    if (result) break;
                }
            }
            const load = () => db.any(finalQuery).then(async rows => {
                return mapTransformRows(reverse ? (rows as any).reverse() as never : rows, args);
            }).then(async rows => {
                // Call the onLoadDone method of each plugin
                for (const onLoadDone of afterCalls) {
                    onLoadDone({
                        result: rows,
                        setResult: (newResult) => { result = newResult; },
                    });
                }
                if (result) return result as never;
                return rows;
            });
            if (result) return result as never;
            return load();
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
            args: Pick<LoadParameters<
                TFilter,
                z.infer<TContextZod>,
                TVirtuals & z.infer<TObject>,
                (TSelect) & TSelectable,
                TSortable,
                TGroupSelected,
                TTakeCursors,
                TDisabledFilters
            >, GetNonEmptyKeys<TFilterTypes, TSortable>> & {
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
        ): Promise<LoadPaginationResult<ResultType<TObject, TVirtuals, TGroups[TGroupSelected][number], TSelect>>> {
            if (args.selectGroups?.length) {
                const groupFields = args.selectGroups.flatMap(group => options.columnGroups?.[group] || []);
                args.select = (args.select || []).concat(...groupFields as any[]);
            }
            if (typeof options.contextFactory === 'function') {
                args.ctx = options.contextFactory(args.ctx);
            }
            if (typeof args.take !== 'number' && options?.defaults?.take) {
                args.take = options.defaults.take;
            }
            const allArgs = args as any;
            const db = database || options?.db;
            if (!db?.any) throw new Error("Database not provided");
            const reverse = !!args.take && args.take < 0 ? -1 : 1;
            const take = (typeof args.take === 'number' && args.take < 0) ? -args.take : args.take;
            if (reverse === -1 && !allArgs.orderBy?.length && !options?.defaults?.orderBy?.length) {
                throw new Error("orderBy must be specified when take parameter is negative!");
            }
            const extraItems = Math.max(Math.min(3, (args?.takeNextPages || 0) - 1), 0) * (take ?? 25) + 1;
            const finalQuery = await getQuery({
                ...args,
                take: // Query an extra row to see if the next page exists
                      (Math.min(Math.max(0, take ?? 100), (options.options?.maxLimit || 1000)) + extraItems) * reverse,
            });
            const countQuery = args.takeCount ? sql.type(countQueryType)`SELECT COUNT(*) FROM (${await getQuery({
                ...args,
                skip: undefined,
                searchAfter: undefined,
                cursor: undefined,
                takeCursors: false,
                take: undefined,
            })}) allrows` : null as never;
            // Count is null by default
            let countPromise = Promise.resolve(null as number | null);
            let countSet = false;
            let result = null as PromiseOrValue<LoadPaginationResult<any>> | null;
            const afterCalls: ((options: { result: LoadPaginationResult<any>; setResult: (newResult: PromiseOrValue<LoadPaginationResult<any>>) => void }) => void)[] = [];
            for (const plugin of options.plugins || []) {
                if (plugin.onLoadPagination) {
                    const done = plugin.onLoadPagination({
                        args,
                        query: finalQuery,
                        countQuery,
                        setCount(newCount) {
                            countPromise = Promise.resolve(newCount);
                            countSet = true;
                        },
                        setResultAndStopExecution(newResult) {
                            result = newResult;
                        },
                    });
                    if (done?.onLoadDone) {
                        afterCalls.push(done.onLoadDone);
                    }
                    if (result) break;
                }
            }
            const load = () => db
                .any(finalQuery)
                .then(async (nodes) => {
                    const slicedNodes = nodes.slice(0, take ?? undefined);
                    const rows = reverse === -1 ? slicedNodes.reverse() as never : slicedNodes;
                    const cursors = allArgs.takeCursors && {
                        startCursor: toCursor((rows[0] as any)?.[cursorColumns]),
                        endCursor: toCursor((rows[rows.length - 1] as any)?.[cursorColumns]),
                        cursors: rows.map((row: any) => {
                            if (row[cursorColumns]) {
                                const cursorcolumns = row[cursorColumns];
                                delete row[cursorColumns];
                                return toCursor(cursorcolumns);
                            }
                        }),
                    };
                    const hasMore = nodes.length > slicedNodes.length;
                    const hasPrevious = !!args.skip || (!!allArgs.cursor || !!allArgs.searchAfter);
                    const allRows = await mapTransformRows(rows, {
                        ...args.ctx,
                        ...args,
                    })
                    return {
                        nodes: allRows,
                        ...(cursors && {
                            cursors: cursors.cursors
                        }),
                        pageInfo: {
                            hasPreviousPage: reverse === -1 ? hasMore : hasPrevious,
                            hasNextPage: reverse === -1 ? hasPrevious : hasMore,
                            minimumCount: (args.skip || 0) + nodes.length,
                            ...(cursors && {
                                startCursor: cursors.startCursor,
                                endCursor: cursors.endCursor,
                            }),
                            count: await countPromise,
                        }
                    };
                }).then((rows) => {
                    // Call the onLoadDone method of each plugin
                    for (const onLoadDone of afterCalls) {
                        onLoadDone({
                            result: rows,
                            setResult: (newResult) => { result = newResult; },
                        });
                    }
                    if (result) return result;
                    return rows;
                });
            if (result) return result;
            if (args.takeCount && !countSet) {
                countPromise = db
                    .any(countQuery)
                    .then((res) => res?.[0]?.count);
            }
            return load();
        },
    }
    return self;
}

export type LoadPaginationResult<T> = {
    nodes: readonly T[];
    cursors?: (string | null)[];
    pageInfo: {
        hasPreviousPage: boolean;
        hasNextPage: boolean;
        minimumCount: number;
        startCursor?: string;
        endCursor?: string;
        count: number | null;
    }
}

export type InferPayload<
    TLoader extends {
        load: (...args: any) => any
    },
    TArgs extends TLoader extends {
        loadPagination: (...args: readonly [infer A]) => any
    } ? Omit<A, "ctx" | "orderBy" | "searchAfter" | "skip" | "take" | "takeCount" | "takeNextPages" | "where" | "cursor" | "distinctOn" | "takeCursors"> : never = never,
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

