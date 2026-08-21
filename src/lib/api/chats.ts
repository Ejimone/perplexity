import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/* Implementation of /api/chats and /api/chats/:id.
 *
 * Both the collection and the per-chat endpoints live here so the hosted
 * catch-all can serve them (see src/app/api/[...path]/route.ts). The thin
 * route files under src/app/api/chats re-export these; the desktop build
 * matches those specific routes first and the hosted build reaches the same
 * code through the catch-all.
 *
 * The per-id handlers take the id as a plain argument rather than Next's
 * `{ params }` context, because the catch-all has already split the path into
 * segments and has no context object to hand on. The route files adapt. */

export const GET = async (req: Request) => {
  try {
    let allChats = await db.query.chats.findMany();
    allChats = allChats.reverse();
    return Response.json({ chats: allChats }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const getChatById = async (id: string) => {
  try {
    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.chatId, id),
    });

    return Response.json(
      {
        chat: chatExists,
        messages: chatMessages,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const deleteChatById = async (id: string) => {
  try {
    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    await db.delete(chats).where(eq(chats.id, id)).execute();
    await db.delete(messages).where(eq(messages.chatId, id)).execute();

    return Response.json(
      { message: 'Chat deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
