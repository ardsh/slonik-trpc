import { QueryResultRowColumn } from "slonik";

export const toCursor = (ids: QueryResultRowColumn[]): string => {
    return ids?.length ? Buffer.from(JSON.stringify(ids)).toString("base64") : '';
};

export const fromCursor = (cursor: string): QueryResultRowColumn[] => {
    return JSON.parse(Buffer.from(cursor, "base64").toString());
};
