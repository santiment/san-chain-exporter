export function getBoolEnvVariable(name: string, defaultValue?: boolean) {
  const value = process.env[name]
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw Error(`Value ${name} need to be set`);
    }
    else {
      return defaultValue;
    }
  }

  const lowerCasedValue = value.trim().toLowerCase();
  return lowerCasedValue === 'true' || lowerCasedValue === '1';
}

export const getLazyBoolEnvVariable = (name: string) => {
  return () => getBoolEnvVariable(name);
};

export function getIntEnvVariable(name: string, defaultValue: number | undefined) {
  const value = process.env[name]
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw Error(`Value ${name} need to be set`);
    }
    else {
      return defaultValue;
    }
  }

  return parseInt(value.trim().toLowerCase());
}

export function assertIsDefined<T>(value: any, errorMsg: string): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw Error(errorMsg);
  }
}
