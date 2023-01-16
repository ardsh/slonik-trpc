
export const toCursor = (ids: Record<string, string>): string => {
    if (ids && typeof ids === 'object') {
        return Buffer.from(JSON.stringify(ids)).toString("base64");
    }
    return '';
};

export const fromCursor = (cursor: string): Record<string, string> => {
    return JSON.parse(Buffer.from(cursor, "base64").toString());
};
