
export const diff = (arr1: any[], arr2: any[]) => {
    return arr1.filter(x => !arr2.includes(x));
}