import { sql } from 'slonik'
import { z } from 'zod'
import { makeQueryTester } from './makeQueryTester';
import { buildView } from '../../index'
import { makeQueryLoader } from '../makeQueryLoader';
import { expectTypeOf } from 'expect-type'

const { db } = makeQueryTester('buildView')

it('Throws an error if view doesn\'t start with from', async () => {
  expect(() => buildView`SELECT * FROM users`).toThrow("First part of view must be FROM");
});

it('Allows building a view from a string', async () => {
  const usersView = buildView`FROM users`
    .addFilters({
      test: (value: string) => sql.fragment`email = ${value}`,
      name: (value: string) => sql.fragment`first_name = ${value}`
    })
    .addStringFilter('users.last_name')
    .addBooleanFilter('long_email', (table) => sql.fragment`LENGTH(${table._main}.email) > 10`)

  const compositeView = buildView`FROM users
    LEFT JOIN test_table_bar ON test_table_bar.uid = users.id`.addFilters(
    usersView.getFilters({
      table: 'users',
      include: ['long_email'],
    })
  ).setFilterPreprocess((filters) => {
    filters['users.long_email'] = true;
    return filters;
  })
  expect(
    (
      await compositeView.getWhereFragment({
        // Automatically adds long_email through preprocessor
        where: {}
      })
    ).sql
  ).toMatch('LENGTH("users".email) > 10')
  const whereFragment = await usersView.getWhereFragment({
    where: {
      'users.last_name': {
        _ilike: '%e%'
      },
      OR: [
        {
          name: 'Haskell'
        },
        {
          name: 'Bob'
        }
      ]
    },
    options: {
      orEnabled: true,
    },
  });
  const data = await db.any(
    sql.unsafe`SELECT * ${usersView} ${whereFragment}`
  )
  expect(data).toEqual([expect.anything(), expect.anything()])
});

it("Doesn't allow arrays with custom filters", async () => {
  expect(() => buildView`FROM users`
    .addBooleanFilter(['long_email', 'something_else'], (table) => sql.fragment`LENGTH(${table._main}.email) > 10`)
  ).toThrow("If you specify a mapper function you cannot have multiple filter keys");
});
it("Allows specifying multiple keys", async () => {
  const userView = buildView`FROM users`.addStringFilter(['email', 'first_name', 'last_name'])

  const query = await userView.getWhereFragment({
    where: {
      last_name: 'buzz',
      email: 'fizz',
    }
  });
  expect(query.sql).toContain(`"last_name" = `);
  expect(query.values).toEqual(['buzz', 'fizz']);
});

it("Cannot determine table for nonsensical views", async () => {
  expect(() => buildView`SELECT * FROM users`).toThrow("First part of view must be FROM");
  buildView`FROM (SELECT * FROM users)`
});

it("Allows specifying views in query loader", async () => {
  const userView = buildView`FROM (SELECT * FROM users WHERE LENGTH(users."first_name") < 8) users`
    .addStringFilter(['email', 'first_name', 'last_name'])
    .setConstraints((ctx) => {
      return sql.fragment`users.id IS NOT NULL`;
    })

  const loader = makeQueryLoader({
    db,
    query: {
      select: sql.unsafe`SELECT *`,
      view: userView,
    }
  })
  const query = await loader.getQuery({
    where: {
      last_name: 'buzz',
    }
  });
  expect(query.sql).toContain(`"last_name" = `);
  expect(query.sql).toContain(`users.id IS NOT NULL`);
  expect(query.sql).toContain("LENGTH(users.\"first_name\") < 8");
  expect(query.values).toEqual(['buzz']);

  const data = await loader.load({
    where: {
      last_name: 'Dean',
    }
  });
  expect(data).toEqual([expect.anything()]);
});


it("Allows specifying composite tables", async () => {
  const userView = buildView`FROM users LEFT JOIN posts
  ON posts.user_id = users.id`
  .addStringFilter(['users.email', 'users.first_name', 'posts.text', 'users.last_name'])
  .addStringFilter('posts.title', ({ posts }) => sql.fragment`${posts}.title`)

  const query = await userView.getWhereFragment({
    where: {
      'users.last_name': 'buzz',
      'users.email': 'fizz',
      'posts.title': 'foo',
    }
  });
  expect(query.sql).toContain(`"users"."last_name" = `);
  expect(query.sql).toContain(`"users"."email" = `);
  expect(query.sql).toContain(`"posts".title = `);

  const compositeView = buildView`FROM (SELECT users.*, COUNT(posts.*)
    FROM users LEFT JOIN posts
  ON posts.user_id = users.id GROUP BY users.id) combined`.addFilters(
    userView.getFilters({
      table: 'combined',
      exclude: ['posts.*'],
    })
  )
  .addComparisonFilter('combined.count')
  .setFilterPreprocess(() => {
    return null as any;
  })
  const composite = await compositeView.getWhereFragment({
    where: {
      OR: [{
        'combined.count': {
          _gt: 10,
        },
      }, {
        "combined.users.last_name": 'abc',
      }]
    },
    options: {
      orEnabled: true,
    }
  });
  expect(composite.sql).toContain(`"combined"."count" > `);
  expect(composite.sql).toContain(`"combined"."last_name" = `);

  const filters = compositeView.getFilters({
    exclude: ['combined.users.last_name'],
    include: ['combined.users.email', 'combined.users.first_name', 'combined.count'],
  });
  expect(filters).toEqual({
    'combined.count': expect.anything(),
    'combined.users.email': expect.anything(),
    'combined.users.first_name': expect.anything(),
  });
});

describe("Filters", () => {
  const userView = buildView`FROM users LEFT JOIN posts
    ON posts.user_id = users.id`
    .setTableAliases({
      users: 'users',
    })
    .addStringFilter(['users.email', 'users.first_name', 'users.last_name', 'posts.title'])
    .addGenericFilter('ID', (value: string) => sql.fragment`users.id = ${value}`)
    .addInArrayFilter('users.id', (table) => sql.fragment`${table.users}.id`)
    .addStringFilter(['users.name', 'users.profession'])
    .addComparisonFilter('usersID', (table, value) => sql.fragment`${table.users}.id`)
    .addComparisonFilter('postsCount', ({ users }) => sql.fragment`${users}."authoredPosts"`)
    .addDateFilter('users.created_at')
    .addJsonContainsFilter('settings')
    .addBooleanFilter(
      'isGmail',
      table => sql.fragment`${table.users}.email ILIKE '%gmail.com'`,
      sql.fragment`users.email NOT ILIKE '%gmail.com'`
    )

  it("Allows specifying generic filters", async () => {
    const query = await userView.getWhereFragment({
      where: {
        NOT: {
          ID: '123',
        }
      }
    });
    expect(query.sql).toContain(`users.id = `);
  });
  it("Allows specifying in array filters", async () => {
    const query = await userView.getWhereFragment({
      where: {
        isGmail: false,
        postsCount: {
          _gte: 30,
        },
        "users.profession": {
          _ilike: '%engineer%',
        },
        "users.created_at": {
          _lt: '2020-01-01',
        },
        OR: [{
          'users.id': ['123', '456'],
        }, {
          ID: '123',
        }]
      },
      options: {
        orEnabled: true,
      }
    });
    expect(query.sql).toContain(`"users".id = ANY(`);
    expect(query.sql).toContain(`users.id = $`);
    expect(query.sql).toContain(` OR (`);
    expect(query.sql).toContain(`NOT ILIKE '%gmail.com'`);
  });
  it("Allows specifying comparison filters", async () => {
    const query = await userView.getWhereFragment({
      where: {
        AND: [{
          usersID: {
            _gt: 10,
          },
        }, {
          "posts.title": 'abc',
        }],
        "users.created_at": {
          _is_null: true,
        }
      }
    });
    expect(query.sql).toContain(`"users".id > `);
    expect(query.sql).toContain(`"posts"."title" = `);
    expect(query.sql).toContain(` AND (`);
    expect(query.sql).toContain(`IS NULL`);
  });
  it('json filter handles a combination of different types', async () => {
    const settings = {
      theme: 'dark',
      notifications: false,
      preferences: {
        layout: 'compact'
      },
      themes: ['dark', 'light']
    }
    const query = await userView.getWhereFragment({
      where: {
        settings,
      }
    });
    expect(query.sql).toContain(`("users"."settings")::jsonb @> $1::jsonb`);
    expect(query.values).toEqual([JSON.stringify(settings)]);
  });
  it("json filter is ignored if null", async () => {
    const query = await userView.getWhereFragment({
      where: {
        settings: null,
      }
    });
    expect(query?.sql).toBeFalsy();
  });


  describe('View Data Loading', () => {
    const userPostType = z.object({
      id: z.string(),
      text: z.string()
    })
    it('loads data from a view', async () => {
      const data = await userView.load({
        where: {
          settings: null
        },
        select: sql.type(
          userPostType
        )`SELECT DISTINCT ON(posts.text) users.id, posts.text`,
        orderBy: sql.fragment`posts.text DESC NULLS LAST`,
        db
      })
      expect(data[0]).toEqual({
        id: expect.any(String),
        text: expect.any(String)
      })
      expectTypeOf(data[0]).toEqualTypeOf<{
        id: string
        text: string
      }>()

      expect(data[0].text > data[1].text).toBe(true)
    })

    it('handles groupBy argument for getting the count of user posts', async () => {
      const data = await userView.load({
        where: {
          settings: null
        },
        select: sql.fragment`SELECT users.id, COUNT(*)`,
        groupBy: sql.fragment`users.id`,
        db
      })
      expect(data[0]).toEqual({
        id: expect.any(String),
        count: expect.any(Number)
      })
    })

    it('handles take, and skip arguments', async () => {
      const data = await userView.load({
        select: sql.fragment`SELECT users.id, posts.text`,
        orderBy: sql.fragment`users.id DESC`,
        take: 5,
        skip: 2,
        db
      })
      expect(data.length).toBe(5)
    })
    it('handles take, and skip arguments together with groupBy', async () => {
      const data = await userView.load({
        select: sql.fragment`SELECT users.id, COUNT(*)`,
        orderBy: sql.fragment`users.id DESC`,
        groupBy: sql.fragment`users.id`,
        take: 5,
        skip: 2,
        db
      })
      expect(data.length).toBe(5)
      expect(data[0]).toEqual({
        id: expect.any(String),
        count: expect.any(Number)
      })
    })

    it('Can take pre-selected columns', async () => {
      const data = await userView
        .setColumns(["first_name", "email"])
        .setColumns({
          count: sql.fragment`COUNT(*)`,
          id: sql.fragment`id`,
        })
        .load({
          select: ["count", "email", "first_name"],
          orderBy: sql.fragment`users.id DESC`,
          groupBy: sql.fragment`users.id`,
          take: 5,
          skip: 2,
          db,
        })
        expect(data.length).toBe(5)
        expect(data[0]).toEqual({
          first_name: expect.any(String),
          email: expect.any(String),
          count: expect.any(Number),
        })
    })
  })
});
