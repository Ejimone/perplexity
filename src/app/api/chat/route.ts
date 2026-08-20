/* Thin re-export. The implementation lives in @/lib/api/chat so that both this route and
 * the catch-all at src/app/api/[...path]/route.ts can serve it — a hosted
 * deploy keeps only the catch-all, because Vercel bills two serverless
 * functions per route and the free plan allows twelve. */
export { runtime, dynamic, POST } from '@/lib/api/chat';
