import { sql } from 'slonik';
import { z } from 'zod';
import { createFilters, makeFilter, mergeFilters, arrayFilter, booleanFilter, dateFilter, dateFilterType, arrayifyType } from '../../utils';

const filtersOptions = createFilters()({
    id: arrayifyType(z.number()),
    uid: arrayifyType(z.string()),
    largeIds: z.boolean(),
    date: dateFilterType
}, {
    id: (text) => sql.fragment`"id" = ${text}`,
    date: async (date) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return dateFilter(date, sql.fragment`"date"`);
    },
    // If true is specified, id must be greater than 5
    largeIds: (filter) => booleanFilter(filter, sql.fragment`"id" > 5`),
    uid: async (uids) => arrayFilter(uids, sql.fragment`"uid"`),
}, {
    postprocess(conditions) {
        conditions.push(sql.fragment`uid = 'x'`)
        return conditions;
    }
});
const getConditions = makeFilter(filtersOptions.interpreters, filtersOptions.options);

type Filter = Parameters<typeof getConditions>[0];
const filters = [] as [string, Filter][];

const addFilter = (text: string, filter: Filter) => {
    filters.push([text, filter]);
}

addFilter("Filters on date fields", {
    date: {
        _gt: "2022-02-03",
    }
});

addFilter("Filters on array string fields with a single string", ({
    uid: 'z',
}))

addFilter("Filters on array string fields with multiple", ({
    uid: ['y', 'x'],
}))

addFilter("AND Filters", ({
    AND: [{
        uid: ['y', 'x'],
    }, {
        id: 3,
    }]
}))

addFilter("AND Filters nested with OR", ({
    AND: [{
        OR: [{
            uid: ['y', 'x'],
        }, {
            largeIds: false,
        }]
    }, {
        id: 3,
    }]
}));

it.each(filters)(
    "%s", async (description, data) => {
        expect(await getConditions(data)).toMatchSnapshot();
    }
);


const otherFilters = createFilters()({
    isCheap: z.boolean(),
    isBeforeNow: z.boolean(),
}, {
    isCheap: (filter) => booleanFilter(filter, sql.fragment`"value" ILIKE '%cheap%'`),
    isBeforeNow: (filter) => booleanFilter(filter, sql.fragment`"date" < NOW()`),
}, {
    preprocess(filters) {
        if (filters) {
            filters.isCheap = true;
        }
        return filters;
    }
});

const anotherFilters = createFilters()({
    randomNumber: arrayifyType(z.number()),
    valueFilter: arrayifyType(z.string()),
}, {
    randomNumber: (text) => sql.fragment`"id" = ${sql.array(text as number[], 'numeric')}`,
    valueFilter: (value) => arrayFilter(value, sql.fragment`"value"`),
}, {
    postprocess(conditions) {
        conditions.push(sql.fragment`uid = 'anotherFilter'`);
        return conditions;
    }
});

const combinedFilter = mergeFilters([filtersOptions, otherFilters, anotherFilters]);

// const loader = makeQueryLoader({
//     query: sql.type(z.object({ id: z.number() }))`SELECT 2 AS "id"`,
//     filters: combinedFilter,
// });

const getCombinedConditions = makeFilter(createFilters()(combinedFilter.filters, combinedFilter.interpreters, combinedFilter.options).interpreters, combinedFilter.options);

type CombinedFilter = Parameters<typeof getCombinedConditions>[0];
const combined = filters.slice() as [string, CombinedFilter][];

const addCombinedFilter = (text: string, filter: CombinedFilter) => {
    combined.push([text, filter]);
}

addCombinedFilter("AND Filters deeply nested with OR", ({
    AND: [{
        OR: [{
            uid: ['y', 'x'],
            NOT: {
                isCheap: false,
            }
        }, {
            isBeforeNow: false,
        }]
    }, {
        randomNumber: [2, 1],
    }]
}));

addCombinedFilter("AND with empty OR array", ({
    AND: [{
        OR: [],
        randomNumber: [3, 4],
    }]
}));

addCombinedFilter("OR with empty AND array", ({
    OR: [{
        AND: [],
        valueFilter: ['test'],
    }]
}));

addCombinedFilter("Empty AND and OR arrays", ({
    AND: [],
    OR: [],
    isCheap: true,
}));

it.each(combined)(
    "%s", async (description, data) => {
        expect(await getCombinedConditions(data)).toMatchSnapshot();
    }
);
