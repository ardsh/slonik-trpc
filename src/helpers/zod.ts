import * as zod from 'zod';
import type { QueryLoader } from './queryAnalyzer';
import type { InferArgs } from '../core/makeQueryLoader';

export function notEmpty<TValue>(value: TValue | null | undefined | void): value is TValue {
    return value !== null && value !== undefined;
}

export type GenerateMockOptions<TLoader extends QueryLoader, TWhere=InferArgs<TLoader> extends { where?: infer TWhere } ? Omit<TWhere, "AND" | "OR" | "NOT"> : never> = {
    zodMappers?: {
        [key in keyof typeof zod]?: (field: string, zodType: zod.ZodTypeAny) => (typeof zod[key]) extends zod.ZodType<infer TOutput> ? TOutput : any;
    },
    mappers?: {
        [key in keyof TWhere]?: () => TWhere[key];
    }
}

export function mockZod(field: zod.ZodTypeAny, options?: GenerateMockOptions<any> & { fieldName?: string, counter?: number }): any {
    const fieldName = options?.fieldName || '';
    if (options?.zodMappers && field?._def?.typeName in options.zodMappers) {
        return (options.zodMappers as any)[field._def.typeName](fieldName, field);
    }
    if (options?.mappers && fieldName in options.mappers) {
        return (options.mappers as any)[fieldName](fieldName, field);
    }
    if (field instanceof zod.ZodNumber) {
        return 1;
    } else if (field instanceof zod.ZodString) {
        return '2023-01-01';
    } else if (field instanceof zod.ZodArray) {
        return Math.random() > 0.5 ? [mockZod((field._def as any).type, options)] : [];
    } else if (field instanceof zod.ZodBoolean) {
        return Math.random() > 0.5;
    } else if (field instanceof zod.ZodUnion) {
        return mockZod((field._def as any).options[0], options);
    } else if (field instanceof zod.ZodEnum) {
        return (field._def as any)?.values?.[0];
    } else if (field instanceof zod.ZodNullable || field instanceof zod.ZodOptional) {
        return mockZod((field._def as any).innerType, options);
    } else if (field instanceof zod.ZodEffects) {
        return mockZod((field._def as any).schema, options);
    } else if (field instanceof zod.ZodNever) {
        return undefined;
    } else if (field instanceof zod.ZodNull) {
        return null;
    } else if (field instanceof zod.ZodDefault) {
        return (field._def as any)?.defaultValue();
    } else if (field instanceof zod.ZodLazy && (options?.counter || 0) < 100) {
        return mockZod((field._def as any).getter(), {
            ...options,
            counter: (options?.counter || 0) + 1,
        });
    }
    if (field instanceof zod.ZodObject) {
        return Object.fromEntries(Object.entries(field.shape).map(([key, value]) => [key, mockZod(value as any, {
            ...options,
            fieldName: key,
        })]));
    }
    return field._def?.typeName;
}
