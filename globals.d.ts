// /src/globals.d.ts
// Global TypeScript declaration file to allow importing CSS modules
declare module '*.css';

declare module '*.svg' {
  import type { FC, SVGProps } from 'react';

  const content: FC<SVGProps<SVGSVGElement>>;
  export default content;
}
