export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type Id<TEntity extends string> = Brand<string, `${TEntity}_id`>;

export type Iso8601 = Brand<string, 'iso8601'>;

export type Cursor = Brand<string, 'cursor'>;

export type Nullable<T> = T | null;
