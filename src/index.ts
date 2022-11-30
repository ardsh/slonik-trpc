import { makeQueryLoader } from './core/makeQueryLoader';

export {
    makeQueryLoader
} from './core/makeQueryLoader';

type ReturnFirstArgument<T> = T extends (...args: readonly [(infer A)]) => any ? <G extends A=A>(...args: readonly [G]) => G : T;
export const createOptions: ReturnFirstArgument<typeof makeQueryLoader> = ((options) => {
    return options;
});
