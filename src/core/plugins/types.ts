import { QuerySqlToken } from "slonik";
import { PromiseOrValue } from "../../helpers/types";
import { LoadParameters, LoadPaginationResult } from "../makeQueryLoader";

type OnGetQueryOptions = {
    args: LoadParameters<any, any, any, any, string, string, boolean>,
    query: QuerySqlToken,
}

type OnLoadOptions<TObject extends Record<string, any>=any> = {
    args: LoadParameters<any, any, TObject, any, string, string, boolean>,
    query: QuerySqlToken
    setResultAndStopExecution: (newResult: PromiseOrValue<TObject[]>) => void;
}

type OnLoadPaginationOptions<TObject extends Record<string, any>=any> = {
    args: LoadParameters<any, any, TObject, any, string, string, boolean>,
    query: QuerySqlToken;
    countQuery: QuerySqlToken;
    setResultAndStopExecution: (newResult: PromiseOrValue<LoadPaginationResult<TObject>>) => void;
}

export type Plugin<TObject extends Record<string, any>=any> = {
    onGetQuery?: (options?: OnGetQueryOptions) => void;
    onLoad?: (options: OnLoadOptions<TObject>) => {
        onLoadDone?: (options: { result: readonly TObject[]; setResult: (newResult: PromiseOrValue<TObject[]>) => void }) => void;
    } | undefined | void;
    onLoadPagination?: (options: OnLoadPaginationOptions<TObject>) => {
        onLoadDone?: (options: { result: LoadPaginationResult<TObject>; setResult: (newResult: PromiseOrValue<LoadPaginationResult<TObject>>) => void }) => void;
    } | undefined | void;
}
