import { makeQueryLoader } from './core/makeQueryLoader';

export {
    makeQueryLoader, InferArgs, InferPayload
} from './core/makeQueryLoader';

type ReturnFirstArgument<T> = T extends (...args: readonly [(infer A)]) => any ? <G extends A=A>(...args: readonly [G]) => G : T;
export const createOptions: ReturnFirstArgument<typeof makeQueryLoader> = ((options) => {
    return options;
});

export type { Plugin } from './core/plugins/types';

export { buildView } from './core/buildView';

export { sql } from 'slonik';
