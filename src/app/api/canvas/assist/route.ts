import ModelRegistry from '@/lib/models/registry';
import {
  canvasAssistPrompt,
  canvasAssistUserMessage,
} from '@/lib/prompts/canvas';
import type { Message } from '@/lib/types';
import { z } from 'zod';

/* Streaming AI assistance for the coding canvas.
 *
 * Server-side for the same reason every other model call in this app is:
 * provider credentials live in config.json with scope 'server' and must never
 * reach the renderer.
 *
 * The wire format is newline-delimited JSON, matching /api/chat — note that
 * that route also labels itself text/event-stream while emitting NDJSON, so
 * the client reads it with a plain reader loop, not an EventSource. */

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  chatModel: z.object({
    providerId: z.string().min(1),
    key: z.string().min(1),
  }),
  language: z.enum(['javascript', 'python', 'cpp', 'java']),
  code: z.string().max(200_000),
  selection: z.string().max(200_000).optional(),
  errorText: z.string().max(20_000).optional(),
  instruction: z.string().max(4_000).optional(),
});

export const POST = async (req: Request) => {
  try {
    const parsed = bodySchema.safeParse(await req.json());

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const body = parsed.data;

    const registry = new ModelRegistry();
    const llm = await registry.loadChatModel(
      body.chatModel.providerId,
      body.chatModel.key,
    );

    const messages: Message[] = [
      { role: 'system', content: canvasAssistPrompt(body.language) },
      { role: 'user', content: canvasAssistUserMessage(body) },
    ];

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    /* Writes race the client aborting the fetch. A write to a closed stream
       must not take down the generator loop. */
    const safeWrite = (payload: Record<string, any>) => {
      try {
        writer.write(encoder.encode(JSON.stringify(payload) + '\n'));
      } catch {}
    };
    const safeClose = () => {
      try {
        writer.close();
      } catch {}
    };

    const abort = req.signal;

    (async () => {
      try {
        for await (const chunk of llm.streamText({ messages })) {
          if (abort.aborted) break;
          if (chunk.contentChunk) {
            safeWrite({ type: 'chunk', data: chunk.contentChunk });
          }
        }
        if (!abort.aborted) safeWrite({ type: 'end' });
      } catch (err: any) {
        console.error('canvas assist failed:', err);
        safeWrite({
          type: 'error',
          data: err?.message ?? 'The model request failed.',
        });
      } finally {
        safeClose();
      }
    })();

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('canvas assist failed to start:', err);
    return Response.json(
      { message: err?.message ?? 'Failed to start assist' },
      { status: 500 },
    );
  }
};
