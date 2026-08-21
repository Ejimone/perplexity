import { deleteChatById, getChatById } from '@/lib/api/chats';

/* Adapts Next's route context to the plain-id implementations in
   src/lib/api/chats, which the hosted catch-all also calls. */

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => getChatById((await params).id);

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => deleteChatById((await params).id);
