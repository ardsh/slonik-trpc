import { toCursor } from '../cursors';

test("Cursor from json", () => {
    expect(toCursor({ id: "1" })).toEqual("eyJpZCI6IjEifQ==");
});

test("Cursor from string", () => {
    // @ts-expect-error string not allowed
    expect(toCursor(`{"id":1}`)).toEqual("eyJpZCI6MX0=");
});

test("Cursor from empty", () => {
    // @ts-expect-error null not allowed
    expect(toCursor(null)).toEqual("");
});
