// Global type declarations for Azure DevOps Extension SDK

declare const VSS: any;

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};