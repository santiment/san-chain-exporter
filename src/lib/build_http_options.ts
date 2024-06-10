import { HttpProviderOptions } from 'web3-providers-http';

export function buildHttpOptions(authCredentials: string): HttpProviderOptions {
  return {
    providerOptions: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(authCredentials).toString('base64')
      }
    },
  };
};

