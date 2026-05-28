import { Amplify } from 'aws-amplify';

export interface AppEnvironment {
  production: boolean;
  appsync: {
    endpoint: string;
    region: string;
    apiKey: string;
  };
}

export function configureAmplify(env: AppEnvironment): void {
  Amplify.configure({
    API: {
      GraphQL: {
        endpoint: env.appsync.endpoint,
        region: env.appsync.region,
        defaultAuthMode: 'apiKey',
        apiKey: env.appsync.apiKey,
      },
    },
  });
}
