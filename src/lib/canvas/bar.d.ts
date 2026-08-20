/* Surface exposed by desktop/preload-bar.cjs, present only inside the
 * floating-bar window. Everywhere else `window.simplicityBar` is undefined,
 * which is why every call site guards with `?.`. */
declare global {
  interface Window {
    simplicityBar?: {
      hide: () => void;
      resize: (width: number, height: number) => void;
    };
  }
}

export {};
