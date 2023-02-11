import { sql } from 'slonik';
import { z } from 'zod';
import { rowToJson } from '../../utils';
import { makeQueryLoader } from '../makeQueryLoader';
import { makeQueryTester } from "./makeQueryTester";

const db = makeQueryTester('performance').db;

const query = {
    select: sql.type(z.object({
        id: z.number(),
        uid: z.string(),
        value: z.string(),
        date: z.number(),
        user: z.object({
            first_name: z.string(),
            last_name: z.string(),
            email: z.string(),
        }),
    }))`SELECT test_table_bar.id, uid, value, date
    , ${rowToJson(
        sql.fragment`
        SELECT first_name, last_name, email
        WHERE users.id IS NOT NULL`, 'user'
    )}`,
    from: sql.fragment`FROM test_table_bar
    LEFT JOIN users
    ON users.id = test_table_bar.uid`,
};

const loader = makeQueryLoader({
    query,
    db,
});
let baseline = 200;

beforeAll(async () => {
    await db.query(sql.unsafe`
        INSERT INTO users
            (id, first_name, last_name, email)
        SELECT id::text, 'Bob' AS first_name, 'LastName' AS last_name, 'Email' AS email
        FROM generate_series(10, 30000) id;

        INSERT INTO test_table_bar
            (id, uid, value, date)
        SELECT id, id::text AS uid, 'valuevalue' || random()::text AS value, (NOW()::date - INTERVAL '500 day' * RANDOM())
        FROM generate_series(10, 30000) id;
    `);
    const start = Date.now();
    const data = await loader.load({
        take: 10000,
    });
    baseline = Date.now() - start;
});


it("Virtual fields without promises", async () => {
    const loader = makeQueryLoader({
        query,
        db,
        virtualFields: {
            blabla: {
                dependencies: ["date"],
                resolve(row) {
                    return row.date;
                }
            }
        }
    });

    const start = Date.now();
    const data = await loader.load({
        take: 10000,
    });
    expect(Date.now() - start).toBeLessThan(baseline * 1.05);
});

it("Virtual fields with promises", async () => {
    const loader = makeQueryLoader({
        query,
        db,
        virtualFields: {
            blabla: {
                dependencies: ["date"],
                async resolve(row) {
                    return row.date;
                }
            }
        }
    });

    const start = Date.now();
    const data = await loader.load({
        take: 10000,
    });
    expect(Date.now() - start).toBeLessThan(baseline * 1.30);
});
