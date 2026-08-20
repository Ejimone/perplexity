import path from 'node:path';
import pkg from './package.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* The desktop shell runs .next/standalone/server.js as a child process, so
     it needs the standalone bundle. Vercel does not — it builds its own
     serverless output, and Next's own docs say standalone is unnecessary
     there. Leaving it on makes Vercel emit a function per traced entry
     instead of one per route, which blows past the plan's function limit even
     though the route table is small. */
  output: process.env.VERCEL ? undefined : 'standalone',
  images: {
    remotePatterns: [
      {
        hostname: 's2.googleusercontent.com',
      },
    ],
  },
  serverExternalPackages: [
    'pdf-parse',
    'playwright',
    'officeparser',
    'file-type',
    /* Bundling jsdom rewrites its internals enough that one of its transitive
       dependencies ends up require()-ing an ES module, which throws at import
       time. Left external, it loads as the published package and works. */
    'jsdom',
  ],
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/@napi-rs/canvas/**',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
      './node_modules/@napi-rs/canvas-linux-x64-musl/**',
      /* Migrations are read from disk at boot. The desktop shell copies them
         into DATA_DIR itself; a hosted deploy has to carry them in the
         bundle or the database is never created. */
      './drizzle/**',
    ],
  },
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
  },
  turbopack: {
    root: process.cwd(),
  },
  /* The canvas runs Python inside an opaque-origin iframe (see
     src/app/api/canvas/sandbox/[lang]/route.ts). Pyodide therefore fetches its
     wasm and stdlib cross-origin, which needs CORS on the asset directory.
     Scoped to /pyodide/ only — nothing else in the app is readable this way. */
  /* A canvas-only deployment does not ship the chat home page, so send the
     site root somewhere that exists. */
  async redirects() {
    return process.env.CANVAS_ONLY === '1'
      ? [{ source: '/', destination: '/canvas', permanent: false }]
      : [];
  },
  async headers() {
    return [
      {
        source: '/pyodide/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
