declare global {
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
