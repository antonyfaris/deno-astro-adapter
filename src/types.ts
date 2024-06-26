declare global {
  // @ts-ignore - To avoid warnings about redeclaring block-scoped variable
  const process: {
    env: {
      [key: string]: string | undefined;
    };
  };
}

export interface Options {
  port?: number;
  hostname?: string;
  start?: boolean;
  isDenoDeploy?: boolean;
}
