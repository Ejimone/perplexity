import configManager from '@/lib/config';
import ModelRegistry from '@/lib/models/registry';
import { NextRequest, NextResponse } from 'next/server';
import { ConfigModelProvider } from '@/lib/config/types';

type SaveConfigBody = {
  key: string;
  /* Not just strings. Switch fields post booleans and number fields post
     numbers; typing this as `string` is what let the falsy check below look
     reasonable. configManager.updateConfig takes `any`. */
  value: string | number | boolean;
};

export const GET = async (req: NextRequest) => {
  try {
    const values = configManager.getCurrentConfig();
    const fields = configManager.getUIConfigSections();

    const modelRegistry = new ModelRegistry();
    const modelProviders = await modelRegistry.getActiveProviders();

    values.modelProviders = values.modelProviders.map(
      (mp: ConfigModelProvider) => {
        const activeProvider = modelProviders.find((p) => p.id === mp.id);

        return {
          ...mp,
          chatModels: activeProvider?.chatModels ?? mp.chatModels,
          embeddingModels:
            activeProvider?.embeddingModels ?? mp.embeddingModels,
        };
      },
    );

    return NextResponse.json({
      values,
      fields,
    });
  } catch (err) {
    console.error('Error in saving config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const body: SaveConfigBody = await req.json();

    /* Presence, not truthiness. `!body.value` rejected every falsy value a
       field can legitimately hold — `false` from a switch, `0` from a number
       field, `''` when clearing a text field — so turning a server-scoped
       toggle OFF returned 400 and silently failed to save, while turning it on
       worked. Only null and undefined are actually missing. */
    if (!body.key || body.value === undefined || body.value === null) {
      return Response.json(
        {
          message: 'Key and value are required.',
        },
        {
          status: 400,
        },
      );
    }

    configManager.updateConfig(body.key, body.value);

    return Response.json(
      {
        message: 'Config updated successfully.',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('Error in saving config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
