
export const toCursor = (ids: Record<string, string>): string => {
    if (ids && typeof ids === 'object') {
        return Buffer.from(JSON.stringify(ids)).toString("base64");
    } else if (ids && typeof ids === 'string') {
        // In case json is returned as string
        return Buffer.from(ids).toString("base64");
    }
    return '';
};

export const fromCursor = (cursor: string): Record<string, string> => {
    return JSON.parse(Buffer.from(cursor, "base64").toString());
};
