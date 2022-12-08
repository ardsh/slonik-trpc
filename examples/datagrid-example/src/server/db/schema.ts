import { sql } from "slonik";
import { db } from "./slonik";

export async function fillRandomEmployeeData() {
    await db.query(sql.unsafe`WITH first_names AS (
        SELECT s.name AS name FROM
        UNNEST('{Aiden,Alex,Alexia,Amanda,Amelia,Andrew,Anna,Benjamin,Brandon,Brianna,Brooklyn,Cameron,Caroline,Charles,Charlotte,Chloe,Christopher,Claire,Connor,Daniel,David,Dylan,Elizabeth,Ethan,Evan,Evelyn,Gabriel,Grace,Harper,Isabella,Jackson,Jacob,James,Jared,Jessica,John,Joseph,Joshua,Julia,Justin,Kaitlyn,Kayla,Madison,Mason,Matthew,Mia,Michael,Nathan,Olivia,Parker,Patrick,Rachel,Rebecca,Ryan,Samuel,Sophia,Sydney,Taylor,Tyler,Victoria,William,Wyatt,Abigail,Aiden,Alexander,Alexandra,Alexis,Alice,Amanda,Amber,Amelia,Andrew,Angela,Anna,Anne,Ashley,Avery,Benjamin,Bethany,Brandon,Brianna,Brooklyn,Caroline,Charles,Charlotte,Chloe,Christopher,Claire,Connor,Daniel,David,Diana,Dylan,Elizabeth,Emily,Ethan,Evan,Evelyn,Gabriel,Grace,Hailey,Hannah,Harper,Isabella,Jackson,Jacob,James,Jared,Jason,Jayden,Jessica,John,Joseph,Joshua,Julia,Justin,Kaitlyn,Kayla,Kaylee,Madison,Mason,Matthew,Maya,Mia,Michael,Nicholas,Olivia,Parker,Patrick,Rachel,Rebecca,Ryan,Samantha,Samuel,Sarah,Sophia,Sydney,Taylor,Thomas,Victoria,William,Wyatt,Zachary}'::text []) s
    ), last_names AS (
        SELECT s.name AS name FROM
        UNNEST('{Anderson,Brown,Davis,Garcia,Harris,Jackson,Johnson,Jones,King,Lee,Martin,Martinez,Miller,Mitchell,Moore,Perez,Rodriguez,Smith,Taylor,Thomas,Thompson,Turner,White,Williams,Wilson,Baker,Bell,Black,Brooks,Carter,Clark,Cooper,Cox,Davis,Edwards,Evans,Flores,Foster,Green,Hall,Hill,Howard,Howell,Hughes,Jenkins,Kelly,Lewis,Long,Lopez,Martin,Morris,Murphy,Nelson,Parker,Perry,Powell,Reed,Richards,Richardson,Roberts,Scott,Shaw,Simpson,Spencer,Stevens,Stewart,Sullivan,Thompson,Washington,Watkins,Watson,Weaver,White,Williams,Wilson,Wright,Young}'::text[]) s
    ), domains AS (
        SELECT s.name AS domain FROM
        UNNEST('{gmail.com,yahoo.com,outlook.com,hotmail.com,aol.com,icloud.com,zoho.com,protonmail.com,fastmail.com,yandex.com}'::text[]) s
    ), names AS (
        SELECT
            first_names.name AS first_name,
            last_names.name AS last_name,
            LOWER((SELECT first_names.name || '.' || last_names.name || '@' || domains.domain
                FROM domains
                ORDER BY RANDOM() LIMIT 1
            )) email,
            first_names.name || ' ' || last_names.name AS name
        FROM first_names, last_names
        ORDER BY random()
    ), created_employees AS (
        INSERT INTO employees(first_name, last_name, email)
        SELECT names.first_name, names.last_name, names.email
        FROM names
        RETURNING id
    ), created_companies AS (
        INSERT INTO companies(name)
        SELECT 'Company' || (random() * 100000)::integer AS name
        FROM generate_series(1, 300)
        RETURNING id
    ), employee_companies AS (
        INSERT INTO employee_companies(employee_id, company_id, start_date, end_date, salary)
        SELECT e.id::integer AS employee_id,
        (SELECT id FROM created_companies ORDER BY RANDOM() LIMIT 1)::integer AS company_id,
            '2015-01-01'::date + (random() * 365 * 7)::integer AS start_date,
            '2022-01-01'::date + (random() * 365)::integer AS end_date,
            (FLOOR(RANDOM() * 200 + 25)*1000)::numeric AS salary
        FROM created_employees e
    ) SELECT COUNT(*) FROM created_employees;`);
}
