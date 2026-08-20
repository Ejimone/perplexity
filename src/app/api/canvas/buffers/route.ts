import db from '@/lib/db';
import { codeBuffers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/* Buffer persistence for the coding canvas.
 *
 * Deliberately server-side. localStorage would be the obvious home for this,
 * and it is where the rest of the app keeps client preferences — but the
 * desktop shell hands the renderer a new origin on every launch (see the note
 * on codeBuffers in src/lib/db/schema.ts), so localStorage does not actually
 * survive a restart here. SQLite does. */

export const dynamic = 'force-dynamic';

/* An editor buffer is not a document store. The cap is high enough that no
   plausible snippet hits it and low enough that a runaway paste cannot grow
   the user's database without bound. */
const MAX_CONTENT_BYTES = 1_000_000;

const bufferSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  language: z.enum(['javascript', 'python', 'cpp', 'java']),
  content: z.string().max(MAX_CONTENT_BYTES),
});

export const GET = async () => {
  try {
    const rows = await db.query.codeBuffers.findMany();
    return Response.json({ buffers: rows });
  } catch (err) {
    console.error('canvas: failed to read buffers', err);
    return Response.json(
      { message: 'Failed to read buffers' },
      { status: 500 },
    );
  }
};

export const PUT = async (req: Request) => {
  try {
    const parsed = bufferSchema.safeParse(await req.json());

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid buffer', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const buffer = { ...parsed.data, updatedAt: new Date().toISOString() };

    await db
      .insert(codeBuffers)
      .values(buffer)
      .onConflictDoUpdate({
        target: codeBuffers.id,
        set: {
          name: buffer.name,
          language: buffer.language,
          content: buffer.content,
          updatedAt: buffer.updatedAt,
        },
      });

    return Response.json({ ok: true, updatedAt: buffer.updatedAt });
  } catch (err) {
    console.error('canvas: failed to save buffer', err);
    return Response.json({ message: 'Failed to save buffer' }, { status: 500 });
  }
};

export const DELETE = async (req: Request) => {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) {
      return Response.json({ message: 'Missing id' }, { status: 400 });
    }

    await db.delete(codeBuffers).where(eq(codeBuffers.id, id));
    return Response.json({ ok: true });
  } catch (err) {
    console.error('canvas: failed to delete buffer', err);
    return Response.json(
      { message: 'Failed to delete buffer' },
      { status: 500 },
    );
  }
};
