import {
    sql,
    ValueExpression,
    SqlFragment,
    IdentifierSqlToken,
    FragmentSqlToken,
} from "slonik";
import { z } from "zod";
import {
    arrayDynamicFilter,
    arrayFilter,
    booleanFilter,
    comparisonFilter,
    comparisonFilterType,
    dateFilter,
    dateFilterType,
    genericFilter,
    jsonbContainsFilter,
    stringFilter,
    stringFilterType,
} from "../helpers/sqlUtils";
import { notEmpty } from "../helpers/zod";

export type Interpretors<
    TFilter extends Record<string, any>,
    TFilterKey extends keyof TFilter = keyof TFilter extends Record<
        infer K,
        any
    >
        ? K extends string
            ? K
            : never
        : never,
    TContext = any
> = {
    [x in TFilterKey]?: {
        prefix?: string;
        interpret: (
            filter: TFilter[x],
            allFilters: TFilter,
            context: TContext
        ) =>
            | Promise<SqlFragment | null | undefined | false>
            | SqlFragment
            | null
            | undefined
            | false;
    };
};

export type BuildView<
    TFilter extends Record<string, any> = Record<never, any>,
    TFilterKey extends keyof TFilter = never,
    TAliases extends string = "_main"
> = {
    /**
     * Allows adding custom filters to the view
     * Multiple filters can be added at once
     * This is mainly to be used in conjunction with getFilters
     * WARNING: Do not use this otherwise, unless you know what you're doing.
     * Prefer using the other filter methods, especially addGenericFilter if you need more flexibility
     * @param filters - The filters to add
     */
    addFilters<
        TNewFilter extends Record<string, any> = Record<never, any>,
        TNewFilterKey extends keyof TNewFilter = keyof TNewFilter extends Record<
            infer K,
            any
        >
            ? K extends string
                ? K
                : never
            : never
    >(filters: {
        [x in TNewFilterKey]?: (
            filter: TNewFilter[x],
            allFilters: TFilter & TNewFilter,
            context: any
        ) =>
            | Promise<SqlFragment | null | undefined | false>
            | SqlFragment
            | null
            | undefined
            | false;
    }): BuildView<
        TNewFilter & TFilter,
        keyof TNewFilter | TFilterKey,
        TAliases
    >;
    /**
     * Allows filtering by string operators, e.g. "contains", "starts with", "ends with", etc.
     * @param field - The name of the filter - Can be a nested field, e.g. "user.name"
     * @param mapper - Optional if you want to use a different column name than the filter name
     */
    addStringFilter: <TKey extends Exclude<string, TFilterKey>>(
        field: TKey | TKey[],
        name?: (
            table: {
                [x in TAliases]: IdentifierSqlToken;
            } & {
                [x: string]: IdentifierSqlToken;
            },
            value?: z.infer<typeof stringFilterType>,
            allFilters?: TFilter,
            ctx?: any
        ) => SqlFragment
    ) => BuildView<
        TFilter & { [x in TKey]?: z.infer<typeof stringFilterType> },
        keyof TFilter | TKey,
        TAliases
    >;
    /**
     * Allows filtering by comparison operators, e.g. "greater than", "less than", "between", "in", etc.
     * @param field - The name of the filter - Can be a nested field, e.g. "user.name"
     * @param mapper - Optional if you want to use a different column name than the filter name
     * @returns
     */
    addComparisonFilter: <TKey extends Exclude<string, TFilterKey>>(
        name: TKey | TKey[],
        mapper?: (
            table: {
                [x in TAliases]: IdentifierSqlToken;
            } & {
                [x: string]: IdentifierSqlToken;
            },
            value?: z.infer<typeof comparisonFilterType>,
            allFilters?: TFilter,
            ctx?: any
        ) => SqlFragment
    ) => BuildView<
        TFilter & { [x in TKey]?: z.infer<typeof comparisonFilterType> },
        keyof TFilter | TKey,
        TAliases
    >;
    /**
   * Allows filtering jsonb columns, using the @> operator to check if a JSONB column contains a certain value or structure.
   * ```
    view.addJsonContainsFilter('settings', () => sql.fragment`'user.user_settings'`)
    ```
    Allows for
    ```
      where: {
        settings: {
          notifications: true,
          theme: 'dark',
          nested: {
            value: 'something'
          }
        }
      }
    ```
   * */
    addJsonContainsFilter: <TKey extends Exclude<string, TFilterKey>>(
        name: TKey | TKey[],
        mapper?: (
            table: {
                [x in TAliases]: IdentifierSqlToken;
            } & {
                [x: string]: IdentifierSqlToken;
            },
            value?: any,
            allFilters?: TFilter,
            ctx?: any
        ) => SqlFragment
    ) => BuildView<
        TFilter & { [x in TKey]?: Parameters<typeof jsonbContainsFilter>[0] },
        keyof TFilter | TKey,
        TAliases
    >;
    /**
     * Allows filtering by date operators, e.g. "greater than", "less than" etc.
     * */
    addDateFilter: <TKey extends Exclude<string, TFilterKey>>(
        name: TKey | TKey[],
        mapper?: (
            table: {
                [x in TAliases]: IdentifierSqlToken;
            } & {
                [x: string]: IdentifierSqlToken;
            },
            value?: z.infer<typeof dateFilterType>,
            allFilters?: TFilter,
            ctx?: any
        ) => SqlFragment
    ) => BuildView<
        TFilter & { [x in TKey]?: z.infer<typeof dateFilterType> },
        keyof TFilter | TKey,
        TAliases
    >;
    /**
     * Allows preprocessing the filters before they are interpreted
     * */
    setFilterPreprocess: (
        preprocess: (
            filters: TFilter,
            context: any
        ) => Promise<TFilter> | TFilter
    ) => BuildView<TFilter, TFilterKey, TAliases>;
    /**
     * Sets table aliases. By default there's a `_main` alias for the main table that's referenced in the FROM fragment.
     *
     * These aliases can then be used in some of the filters, e.g.
     * ```ts
     * buildView`FROM users`
     * .addStringFilter('name', (table) => sql.fragment`COALESCE(${table._main}.first_name, ${table._main}.last_name)`)
     * ```
     *
     * would be translated to `COALESCE(users.first_name, users.last_name)`
     *
     * because `users` is the main table that's referred in the FROM clause.
     * */
    setTableAliases: <TNewAliases extends string>(
        table: Record<TNewAliases, string | IdentifierSqlToken>
    ) => BuildView<TFilter, TFilterKey, TAliases | TNewAliases>;
    /**
     * Allows filtering by boolean operators, e.g. "is true", "is false", "is null", etc.
     * @param field - The name of the filter - Can be a nested field, e.g. "user.name"
     * @param mapper - Optional if you want to use a different column name than the filter name
     * @returns
     * */
    addBooleanFilter: <TKey extends Exclude<string, TFilterKey>>(
        name: TKey | TKey[],
        mapper?: (
            table: {
                [x in TAliases]: IdentifierSqlToken;
            } & {
                [x: string]: IdentifierSqlToken;
            },
            value?: boolean,
            allFilters?: TFilter,
            ctx?: any
        ) => SqlFragment
    ) => BuildView<
        TFilter & { [x in TKey]?: boolean },
        keyof TFilter | TKey,
        TAliases
    >;
    /**
     * Allows filtering by single or multiple string values
     * And returns all rows where the value is in the array
     * */
    addInArrayFilter: <
        TKey extends Exclude<string, TFilterKey>,
        TType extends "text" | "numeric" | "integer" | "bigint" = never,
        TValue = [TType] extends [never]
            ? string
            : TType extends "numeric" | "integer" | "bigint"
            ? number
            : string
    >(
        name: TKey | TKey[],
        mapper?: (
            table: {
                [x in TAliases]: IdentifierSqlToken;
            } & {
                [x: string]: IdentifierSqlToken;
            },
            value?: TValue | TValue[] | null,
            allFilters?: TFilter,
            ctx?: any
        ) => SqlFragment,
        type?: TType
    ) => BuildView<
        TFilter & { [x in TKey]?: TValue | TValue[] | null },
        keyof TFilter | TKey,
        TAliases
    >;
    /**
     * Use this to add a generic filter, that returns a SQL fragment
     * This filter won't be applied if the value is null or undefined
     * */
    addGenericFilter: <TKey extends Exclude<string, TFilterKey>, TNewFilter>(
        name: TKey,
        interpret: (
            filter: TNewFilter,
            allFilters: TFilter & { TKey: TNewFilter },
            context: any
        ) =>
            | Promise<SqlFragment | null | undefined | false>
            | SqlFragment
            | null
            | undefined
            | false
    ) => BuildView<
        TFilter & { [x in TKey]?: TNewFilter },
        keyof TFilter | TKey,
        TAliases
    >;
    /**
     * Returns the SQL query
     * @param args - The arguments to filter by
     * @returns - The SQL query fragment
     * */
    getWhereConditions(args: {
        where?: RecursiveFilterConditions<{
            [x in TFilterKey]?: TFilter[x];
        }>;
        ctx?: any;
        options?: FilterOptions;
    }): Promise<SqlFragment[]>;
    getWhereFragment(args: {
        where?: RecursiveFilterConditions<{
            [x in TFilterKey]?: TFilter[x];
        }>;
        ctx?: any;
        options?: FilterOptions;
    }): Promise<FragmentSqlToken>;
    getFromFragment(): FragmentSqlToken;
    /**
     * Returns all filters that have been added to the view
     * @param options - Options for configuring the filters
     */
    getFilters<
        TInclude extends Extract<TFilterKey, string> | `${string}*` = never,
        TExclude extends Extract<TFilterKey, string> | `${string}*` = never,
        TRealInclude extends Extract<
            TFilterKey,
            string
        > = TInclude extends `${infer K}*`
            ? Extract<TFilterKey, `${K}${string}`>
            : Extract<TInclude, Extract<TFilterKey, string>>,
        TRealExclude extends Extract<
            TFilterKey,
            string
        > = TExclude extends `${infer K}*`
            ? Extract<TFilterKey, `${K}${string}`>
            : Extract<TExclude, Extract<TFilterKey, string>>,
        TPrefix extends string = "",
        TRealPrefix extends string = TPrefix extends `${string}.`
            ? TPrefix
            : `${TPrefix}.`
    >(options?: {
        table?: TPrefix;
        include?: readonly TInclude[];
        exclude?: readonly TExclude[];
    }): {
        [x in TFilterKey extends TRealExclude
            ? never
            : [TRealInclude] extends [never]
            ? // ([TRealInclude] extends [never] ? TFilterKey : TFilterKey)
              TFilterKey extends `${TRealPrefix}${string}`
                ? TFilterKey
                : `${TRealPrefix}${Extract<TFilterKey, string>}`
            : TFilterKey extends `${TRealPrefix}${string}`
            ? Extract<TFilterKey, TRealInclude>
            : `${TRealPrefix}${Extract<TFilterKey, TRealInclude>}`]?: (
            filter: TFilter[x extends `${TRealPrefix}${infer K}`
                ? K extends TFilterKey
                    ? K
                    : x
                : x],
            allFilters: any,
            context: any
        ) =>
            | Promise<SqlFragment | null | undefined | false>
            | SqlFragment
            | null
            | undefined
            | false;
    };
} & SqlFragment;

type FilterOptions = {
    orEnabled: boolean;
};

export const buildView = (
    parts: readonly string[],
    ...values: readonly ValueExpression[]
) => {
    const fromFragment = sql.fragment(parts, ...values);
    if (!fromFragment.sql.match(/^\s*FROM/i)) {
        throw new Error("First part of view must be FROM");
    }
    const preprocessors = [] as ((
        filters: any,
        context: any
    ) => Promise<any> | any)[];
    const config = {
        table: fromFragment.sql.match(/^FROM\s*(\w+)/i)?.[1],
        aliases: new Map<string, string>(),
    };
    const identifierProxy = new Proxy({} as any, {
        get(target, property) {
            if (property === "_main")
                return sql.identifier([
                    config.aliases.get(property) || config.table || "",
                ]);
            return sql.identifier([
                config.aliases.get(property as string) || (property as string),
            ]);
        },
    });
    if (!config.table) {
        config.table = fromFragment.sql.match(/(AS|\))\s+(\w+)\s*$/i)?.[2];
    }
    const interpreters = {} as Interpretors<Record<string, any>>;

    const getWhereConditions = async (
        filters: RecursiveFilterConditions<any>,
        context?: any,
        options?: FilterOptions
    ) => {
        const postprocessedFilters = await preprocessors.slice(-1).reduce(
            async (acc, preprocessor) => {
                const filters = await acc;
                return preprocessor(filters, context);
            }, filters);
        const conditions = await interpretFilter(
            postprocessedFilters || filters,
            interpreters as any,
            context,
            options,
        );
        return conditions;
    };
    const getWhereFragment = async (
        filters: RecursiveFilterConditions<any>,
        context?: any,
        options?: FilterOptions
    ) => {
        const conditions = await getWhereConditions(filters, context, options);
        return conditions.length
            ? sql.fragment`WHERE (${sql.join(
                  conditions,
                  sql.fragment`\n) AND(\n`
              )})`
            : sql.fragment``;
    };

    const getFromFragment = () => {
        // return sql.fragment`${fromFragment} ${await getWhereFragment(args.where, args.ctx)}`
        return fromFragment;
    };

    const addFilter = (
        interpreter: (value: any, field: FragmentSqlToken) => any,
        fields: string | string[],
        mapper?: (
            table: IdentifierSqlToken | Record<string, IdentifierSqlToken>,
            value?: any,
            allFilters?: any,
            context?: any
        ) => SqlFragment
    ) => {
        if (mapper && Array.isArray(fields) && fields.length > 1) {
            throw new Error(
                "If you specify a mapper function you cannot have multiple filter keys"
            );
        }
        return self.addFilters(
            (Array.isArray(fields) ? fields : [fields]).reduce((acc, key) => {
                return {
                    ...acc,
                    [key]: (
                        value: any,
                        allFilters: any,
                        ctx: any,
                        key: string
                    ) => {
                        const keys = key.split(".");
                        if (keys.length > 2) {
                            // Ignore middle keys (earlier prefixes), only first and last matter
                            keys.splice(1, keys.length - 2);
                        }
                        const identifier = mapper
                            ? // Try to get the table name from the 2nd to last prefix if it exists, if not then use main table
                              mapper(identifierProxy, value, allFilters, ctx)
                            : config.table && keys.length <= 1
                            ? (sql.identifier([
                                  config.table,
                                  ...keys.slice(-1),
                              ]) as any)
                            : (sql.identifier([...keys.slice(-2)]) as any);
                        return interpreter(value, identifier);
                    },
                };
            }, {})
        );
    };
    const self = {
        ...fromFragment,
        getFromFragment,
        addFilters(filters: any) {
            Object.assign(interpreters, filters);
            return self;
        },
        setTableAliases(
            newAliases: Record<string, string | IdentifierSqlToken>
        ) {
            for (const [key, value] of Object.entries(newAliases)) {
                config.aliases.set(key, value as string);
            }
            return self;
        },
        setFilterPreprocess(
            preprocess: (filters: any, context: any) => Promise<any> | any
        ) {
            preprocessors.push(preprocess);
            return self;
        },
        getFilters(options?: any) {
            let prefix = options?.table || "";
            if (prefix && !prefix.endsWith(".")) {
                prefix += ".";
            }
            const exclude = (options?.exclude || []) as string[];
            const include = (options?.include || []) as string[];
            const filters = {} as any;
            for (const key of Object.keys(interpreters)) {
                // exclude may have * wildcards that exclude all filters that start with the prefix
                if (
                    exclude.some((ex) =>
                        ex.endsWith("*")
                            ? key.startsWith(ex.replace("*", ""))
                            : ex === key
                    )
                ) {
                    continue;
                }
                const isIncluded =
                    !include.length ||
                    include.some((ex) =>
                        ex.endsWith("*")
                            ? key.startsWith(ex.replace("*", ""))
                            : ex === key
                    );
                if (isIncluded) {
                    filters[prefix + key.replace(prefix, "")] = {
                        interpret:
                            (interpreters as any)[key]?.interpret ||
                            (interpreters as any)[key],
                        prefix: key.startsWith(prefix) ? "" : prefix,
                    };
                }
            }
            return filters;
        },
        addStringFilter: (keys: string | string[], name?: any) => {
            return addFilter(stringFilter, keys, name);
        },
        addComparisonFilter: (keys: string | string[], name?: any) => {
            return addFilter(comparisonFilter, keys, name);
        },
        addBooleanFilter: (keys: string | string[], name?: any) => {
            return addFilter(booleanFilter, keys, name);
        },
        addJsonContainsFilter: (keys: string | string[], name?: any) => {
            return addFilter(jsonbContainsFilter, keys, name);
        },
        addDateFilter: (keys: string | string[], name?: any) => {
            return addFilter(dateFilter, keys, name);
        },
        addInArrayFilter: (
            keys: string | string[],
            name?: any,
            type?: string
        ) => {
            const arrFilter = type ? arrayDynamicFilter(type) : arrayFilter;
            return addFilter(arrFilter, keys, name);
        },
        addGenericFilter: (name: string, interpret?: any) => {
            return addFilter(genericFilter, name, (table, value, ...args) => {
                return interpret(value, ...args);
            });
        },
        getWhereConditions: async (args: any) => {
            return getWhereConditions(args.where, args.ctx, args.options);
        },
        getWhereFragment: async (args: any) => {
            return getWhereFragment(args.where, args.ctx, args.options);
        },
    };
    return self as BuildView;
};

export type RecursiveFilterConditions<
    TFilter,
    TDisabled extends "AND" | "OR" | "NOT" = never
> = TFilter &
    Omit<
        {
            AND?: RecursiveFilterConditions<TFilter>[];
            OR?: RecursiveFilterConditions<TFilter>[];
            NOT?: RecursiveFilterConditions<TFilter>;
        },
        TDisabled
    >;

const interpretFilter = async <TFilter extends Record<string, any>>(
    filter: RecursiveFilterConditions<TFilter>,
    interpreters: Interpretors<TFilter>,
    context?: any,
    options?: FilterOptions
) => {
    const conditions = [] as SqlFragment[];
    const addCondition = (item: SqlFragment | null) =>
        item && conditions.push(item);
    for (const key of Object.keys(filter)) {
        const interpreter = interpreters[key as never] as any;
        const condition = await (interpreter?.interpret || interpreter)?.(
            filter[key as never],
            filter as TFilter,
            context,
            key
        );
        if (condition) {
            addCondition(condition);
        }
    }
    if (filter.OR?.length) {
        if (!options?.orEnabled) {
            throw new Error(
                "OR filters are not enabled. Please enable by passing { orFilterEnabled: true } in the options"
            );
        }
        const orConditions = await Promise.all(
            filter.OR.map(async (or) => {
                const orFilter = await interpretFilter(or, interpreters, context, options);
                return orFilter?.length
                    ? sql.fragment`(${sql.join(
                          orFilter,
                          sql.fragment`) AND (`
                      )})`
                    : null;
            })
        ).then((filters) => filters.filter(notEmpty));
        if (orConditions?.length) {
            addCondition(
                sql.fragment`(${sql.join(orConditions, sql.fragment`) OR (`)})`
            );
        }
    }
    if (filter.AND?.length) {
        const andConditions = await Promise.all(
            filter.AND.map(async (and) => {
                const andFilter = await interpretFilter(and, interpreters, context, options);
                return andFilter?.length
                    ? sql.fragment`(${sql.join(
                          andFilter,
                          sql.fragment`) AND (`
                      )})`
                    : null;
            })
        ).then((filters) => filters.filter(notEmpty));
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
        const notFilter = await interpretFilter(filter.NOT, interpreters, context, options);
        if (notFilter.length) {
            addCondition(
                sql.fragment`NOT (${sql.join(
                    notFilter,
                    sql.fragment`) AND (`
                )})`
            );
        }
    }

    return conditions;
};
