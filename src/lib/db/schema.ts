import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  messageId: text('messageId').notNull(),
  chatId: text('chatId').notNull(),
  backendId: text('backendId').notNull(),
  query: text('query').notNull(),
  createdAt: text('createdAt').notNull(),
  responseBlocks: text('responseBlocks', { mode: 'json' })
    .$type<Block[]>()
    .default(sql`'[]'`),
  status: text({
    enum: ['answering', 'completed', 'error', 'cancelled'],
  }).default('answering'),
});

interface DBFile {
  name: string;
  fileId: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  sources: text('sources', {
    mode: 'json',
  })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  files: text('files', { mode: 'json' })
    .$type<DBFile[]>()
    .default(sql`'[]'`),
});

/* Coding canvas buffers.
 *
 * These live in SQLite rather than localStorage, which is where every other
 * client-side preference in this app goes. The reason is the desktop shell:
 * desktop/main.mjs picks a fresh ephemeral port for the Next server on every
 * launch (freePort() -> listen(0)), so the renderer's origin changes each time
 * the app starts and localStorage comes up empty. DATA_DIR is stable, so this
 * is the only storage here that genuinely survives a restart. */
export const codeBuffers = sqliteTable('code_buffers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  language: text('language').notNull(),
  content: text('content').notNull().default(''),
  updatedAt: text('updatedAt').notNull(),
});
