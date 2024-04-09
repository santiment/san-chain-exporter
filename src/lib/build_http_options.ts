interface HttpProviderOptions {
  method: string,
  headers: { 
    'Content-Type': string,
    'Authorization': string
  }
}

export function buildHttpOptions(authCredentials: string): { providerOptions: HttpProviderOptions } {
  return {
    providerOptions: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(authCredentials).toString('base64')
      }
    }
  };
}
