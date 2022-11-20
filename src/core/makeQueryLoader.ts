import { sql, CommonQueryMethods, QuerySqlToken, SqlFragment } from "slonik";
import { z } from 'zod';
import { handleZodErrors, notEmpty } from "../helpers/zod";
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
    TSortable extends readonly [string, ...string[]] = never,
> = {
    /** The fields that should be included. If unspecified, all fields are returned. */
    select?: readonly TSelect[];
    /** The fields that should be excluded. Takes precedence over `select`. */
    exclude?: readonly TExclude[];
    /** The amount of rows to query */
    limit?: number;
    /** Specify the count of items to skip, usually (currentPage - 1) * limit */
    skip?: number;
    orderBy?: [TSortable] extends [never] ? never : [TSortable[number], 'ASC' | 'DESC' | 'ASC NULLS LAST' | 'DESC NULLS LAST'] | null;
    context?: TContext;
    where?: RecursiveFilterConditions<TFilter>;
};

const countQueryType = z.object({
    count: z.number(),
});

export function makeQueryLoader<
    TFilterTypes extends Record<string, z.ZodTypeAny>,
    TContext,
    TFragment extends SqlFragment | QuerySqlToken,
    TRequired extends readonly (keyof z.infer<TObject>)[]=[],
    TObject extends z.AnyZodObject=TFragment extends QuerySqlToken<infer T> ? T : any,
    TVirtuals extends Record<string, any> = z.infer<TObject>,
    TPostprocessed extends Record<string, any> = z.infer<TObject>,
    TSortable extends readonly [Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>,
        ...(Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>)[]] = [never],
>(db: CommonQueryMethods, options: {
    query: TFragment,
    type?: TObject,
    /** If you specify custom filters, make sure the fields they reference are accessible from the main query*/
    filters?: {
        filters: TFilterTypes,
        interpreters: Interpretors<TFilterTypes>,
        options?: FilterOptions<TFilterTypes, TContext>
    }
    /** If true, zod type-checking validation will be skipped
     * and no schema validation errors will be thrown */
    skipChecking?: boolean;
    sortableColumns?: TSortable;
    /**
     * Specify a mapping of virtual fields, with their dependencies
    */
    virtualFields?: {
        [x in keyof TVirtuals]?: {
            /** Return the virtual field */
            resolve: (row: z.infer<TObject>) => TVirtuals[x];
            dependencies: readonly (keyof z.infer<TObject>)[];
        };
    };
    /** Specify the fields that will always be required, no matter what the select/exclude options are. */
    required?: TRequired;
    /** A function to postprocess the output.
     * Do NOT use this to declare virtual fields, it's much more limited.
     * Instead, use this when it's necessary to change an existing field, e.g. easier formatting.
     * */
    postprocess?: (data: z.infer<TObject>) => TPostprocessed;
}) {
    const query = options.query;
    const type = options.type || (query as QuerySqlToken).parser;
    if (!type || !(type instanceof z.ZodObject)) throw new Error('Invalid query type provided: ' + (typeof type));
    type TFilter = z.infer<ZodPartial<TFilterTypes>>;
    const interpretFilters = options?.filters?.interpreters ? makeFilter<TFilterTypes, TContext>(options.filters.interpreters, options.filters?.options) : null;
    const dataTransformers = [] as ((data: any) => any)[];
    const sortFields = options?.sortableColumns?.length
            ? z.enum(options.sortableColumns)
            : // If unspecified, no field is allowed to be used for sorting
            (z.never() as never);
    const orderByType = z.tuple([sortFields, orderDirection]);
    const getQuery = <
        TSelect extends keyof (TVirtuals & z.infer<TObject>) = string,
        TExclude extends keyof (TVirtuals & z.infer<TObject>) = never,
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
        TContext,
        TPostprocessed & TVirtuals & z.infer<TObject>,
        TSelect | TRequired[number],
        TExclude,
        TSortable
    >) => {
        const whereCondition = interpretFilters?.(where || ({} as any), context);
        const zodType = options?.skipChecking ? (z.any() as any) : type;
        if (typeof options?.postprocess === 'function') {
            dataTransformers.push(options.postprocess);
        }
        const virtuals = Object.keys(options?.virtualFields || {});
        if (virtuals.length) {
            const selected = select || [];
            const transformer = virtuals
                .map((key: any) => {
                    if (selected.indexOf(key) >= 0 && options?.virtualFields?.[key]?.resolve) {
                        return [key, options?.virtualFields?.[key]?.resolve] as const;
                    }
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
        const fields = Object.keys(type?.keyof?.()?.Values || {}) as any[];
        select = (select || [])
            .concat(requiredFields)
            // Add dependencies from selected fields.
            // .flatMap(field => [field, ...(options?.dependencies?.[field] as any[])])
            .flatMap((field) => [
                field,
                ...((options?.virtualFields?.[field]?.dependencies as any[]) || []),
            ])
            .filter((field) => !fields?.length || fields?.indexOf(field) >= 0);
        const finalKeys = fields
            .filter(notEmpty)
            .filter((column) => !select?.length || select?.includes(column as any))
            // Exclusion takes precedence
            .filter(
                (column) =>
                    !exclude?.length ||
                    !exclude?.includes(column) ||
                    requiredFields.includes(column)
            );

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
    type SelectableField = Exclude<keyof (z.infer<TObject> & TVirtuals), number | symbol>;
    const getSelectableFields = () => {
        return Object.keys(options?.virtualFields || {}).concat(
            Object.keys(type?.keyof?.()?.Values || {})
        ) as [
            SelectableField,
            ...SelectableField[]
        ];
    };

    const getLoadArgs = <
        TFields extends readonly [string, ...string[]] = [never],//[SelectableField, ...SelectableField[]],
        TSort extends readonly [string, ...string[]] = TSortable,
    >(
        {
            sortableColumns = options?.sortableColumns as never,
            selectableFields = null as never,
        }: {
            sortableColumns?: TSort;
            selectableFields?: TFields;
        } = {} as never
    ) => {
        const sortFields = sortableColumns?.length
            ? z.enum(sortableColumns)
            : // If unspecified, no field is allowed to be used for sorting
            (z.never() as never);
        const fields = selectableFields?.length
            ? z.enum(selectableFields)
            : // If unspecified, any field is allowed to be selected
            (z.string() as never)
        return z.object({
            /** The fields that should be included. If unspecified, all fields are returned. */
            select: z.array(fields).optional(),
            /** The fields that should be excluded. Takes precedence over `select`. */
            exclude: z.array(fields).optional(),
            limit: z.number().optional(),
            skip: z.number().optional().default(0),
            takeCount: z.boolean().optional(),
            orderBy: z
                .tuple([sortFields, z.enum(['ASC', 'DESC', 'ASC NULLS LAST', 'DESC NULLS LAST'])])
                .optional()
                .nullable(),
            where: options?.filters?.filters ? recursiveFilterConditions(options?.filters?.filters).nullish() : z.any() as never,
        }).partial();
    };
    const self = {
        getSelectableFields,
        getLoadArgs,
        getQuery,
        // By default, select all fields (string covers all), and don't exclude any fields
        async load<
            TSelect extends keyof (TVirtuals & z.infer<TObject>) = string,
            TExclude extends keyof (TVirtuals & z.infer<TObject>) = never
        >(
            args: LoadParameters<
                TFilter,
                TContext,
                TPostprocessed & TVirtuals & z.infer<TObject>,
                TSelect | TRequired[number],
                TExclude,
                TSortable
            >
        ) {
            const finalQuery = getQuery(args);
            return db.any(finalQuery).then(rows => {
                if (dataTransformers.length) {
                    return rows.map((data) => {
                        return dataTransformers.reduce((acc, transformer) => {
                            return transformer(acc);
                        }, {
                            ...data,
                        })
                    });
                }
                return rows;
            }).catch(handleZodErrors) as Promise<
                Omit<
                    // Include only the difference of TPostprocessed - TVirtuals
                    // Because only those fields are always present after post-processing
                    Omit<TPostprocessed, keyof (TPostprocessed | (z.infer<TObject> & TVirtuals))> &
                    Pick<
                        TVirtuals & z.infer<TObject>,
                        TSelect | TRequired[number]
                    >,
                    Exclude<TExclude, TRequired[number]>
                >[]
            >;
        },
        /**
         * Returns the data in a pagination-convenient form.
         * Specify takeCount: true to query the overall count as if no limit had been specified.
         * Otherwise, count will be null.
         */
        async loadPagination<
            TSelect extends keyof (TVirtuals & z.infer<TObject>) = string,
            TExclude extends keyof (TVirtuals & z.infer<TObject>) = never
        >(
            args: LoadParameters<
                TFilter,
                TContext,
                TPostprocessed & TVirtuals & z.infer<TObject>,
                TSelect | TRequired[number],
                TExclude,
                TSortable
            > & {
                takeCount?: boolean;
            }
        ) {
            const finalQuery = getQuery({
                ...args,
                limit:
                    typeof args.limit === 'number'
                        ? // Query an extra row to see if the next page exists
                          Math.min(Math.max(0, args.limit), 1000) + 1
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
                    .then((res) => res?.[0]?.count)
                    .catch((err) => {
                        console.error('Count query failed', err);
                        return null;
                    });
            }
            return db
                .any(finalQuery)
                .then(async (edges) => {
                    const count = await countPromise;
                    const slicedEdges = edges.slice(0, args.limit || undefined);
                    return {
                        edges: slicedEdges as Omit<
                            Omit<TPostprocessed, keyof (TPostprocessed | (z.infer<TObject> & TVirtuals))> &
                            Pick<
                                TVirtuals & z.infer<TObject>,
                                TSelect | TRequired[number]
                            >,
                            Exclude<TExclude, TRequired[number]>
                        >[],
                        hasNextPage: edges.length > slicedEdges.length,
                        hasPreviousPage: !!args.skip,
                        count,
                    };
                })
                .catch(handleZodErrors);
        },
    }
    return self;
}
