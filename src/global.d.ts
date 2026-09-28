import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      marquee: any;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      marquee: any;
    }
  }
}

export {};
