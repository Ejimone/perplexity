import type { Config } from 'tailwindcss';
import { ACCENT, RAMP, type Ramp } from './src/lib/theme/palette';

/* Colours are imported, not declared. See src/lib/theme/palette.ts -- the same
   module feeds the CodeMirror theme and the chat highlighter, so the three can
   no longer drift. The import is relative on purpose: Tailwind's config loader
   does not resolve the `@/` alias. */

const withAliases = (ramp: Ramp) => ({
  ...ramp,
  primary: ramp[50],
  secondary: ramp[100],
});

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
      },
      borderColor: {
        light: RAMP.light,
        dark: RAMP.dark,
      },
      colors: {
        dark: withAliases(RAMP.dark),
        light: withAliases(RAMP.light),
        /* The app accent. `bg-accent`, `text-accent`, `border-accent/40` and
           every other opacity modifier work because DEFAULT is a plain hex. */
        accent: {
          DEFAULT: ACCENT.DEFAULT,
          hover: ACCENT.hover,
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
    require('@headlessui/tailwindcss')({ prefix: 'headless' }),
  ],
};
export default config;
