import { describe, expect, it, vi, beforeEach } from 'vitest';

/* POST /api/config used to guard with `if (!body.key || !body.value)`, which
   rejects every falsy value a settings field can legitimately hold. The
   visible symptom was that a server-scoped switch could be turned on but not
   off: `false` returned 400 and the preference silently never saved. */

const updateConfig = vi.fn();

vi.mock('@/lib/config', () => ({
  default: {
    updateConfig: (...args: unknown[]) => updateConfig(...args),
    getCurrentConfig: () => ({ modelProviders: [] }),
    getUIConfigSections: () => ({}),
  },
}));

vi.mock('@/lib/models/registry', () => ({
  default: class {
    async getActiveProviders() {
      return [];
    }
  },
}));

const { POST } = await import('./config');

const post = (body: unknown) => POST({ json: async () => body } as never);

describe('POST /api/config value validation', () => {
  beforeEach(() => updateConfig.mockClear());

  it.each([
    ['false from a switch turned off', false],
    ['zero from a number field', 0],
    ['an empty string clearing a text field', ''],
  ])('persists %s', async (_label, value) => {
    const res = await post({ key: 'preferences.someToggle', value });

    expect(res.status).toBe(200);
    expect(updateConfig).toHaveBeenCalledWith('preferences.someToggle', value);
  });

  it('persists ordinary truthy values', async () => {
    const res = await post({ key: 'preferences.canvasSurface', value: 'bar' });

    expect(res.status).toBe(200);
    expect(updateConfig).toHaveBeenCalledWith(
      'preferences.canvasSurface',
      'bar',
    );
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('rejects %s, which is genuinely missing', async (_label, value) => {
    const res = await post({ key: 'preferences.someToggle', value });

    expect(res.status).toBe(400);
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('rejects a missing key', async () => {
    const res = await post({ key: '', value: 'x' });

    expect(res.status).toBe(400);
    expect(updateConfig).not.toHaveBeenCalled();
  });
});
