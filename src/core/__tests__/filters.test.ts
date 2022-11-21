import { sql } from 'slonik';
import { z } from 'zod';
import { createFilters, makeFilter } from '../queryFilter';
import { arrayFilter, booleanFilter, dateFilter, dateFilterType } from '../../helpers/sqlUtils';
import { arrayifyType } from '../../helpers/zod';

const filtersOptions = createFilters()({
    id: arrayifyType(z.number()),
    uid: arrayifyType(z.string()),
    largeIds: z.boolean(),
    date: dateFilterType
}, {
    id: (text) => sql.fragment`"id" = ${text}`,
    date: (date) => dateFilter(date, sql.fragment`"date"`),
    // If true is specified, id must be greater than 5
    largeIds: (filter) => booleanFilter(filter, sql.fragment`"id" > 5`),
    uid: (uids) => arrayFilter(uids, sql.fragment`"uid"`),
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
    "%s", (description, data) => {
        expect(getConditions(data)).toMatchSnapshot();
    }
);
