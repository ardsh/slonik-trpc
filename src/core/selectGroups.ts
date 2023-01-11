
export const createGroupSelector = <
    TLoader extends {
        load: (...args: any) => any
    },
    TArgs = TLoader extends {
        loadPagination: (...args: readonly [infer A]) => any
    } ? A : any,
    TSelect extends string = TArgs extends {
        select?: ArrayLike<infer A>
    } ? A extends string ? A : any : any,
>() => <
    TFields extends TSelect = TSelect,
>(fields: TFields[]) => {
    return {
        select: fields,
    };
}
