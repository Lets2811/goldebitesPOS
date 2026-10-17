import { OptionGroup } from './option-group.interface';
import { resolveOptionSelections } from './resolve-option-selections';

const group = (
  id: string,
  name: string,
  displayOrder: number,
  items: [string, string, boolean?][],
  extra: Partial<OptionGroup> = {},
): OptionGroup => ({
  id,
  businessId: 'b1',
  name,
  singularName: name,
  isActive: true,
  isRequired: false,
  defaultMax: 1,
  displayOrder,
  productCount: 0,
  items: items.map(([itemId, itemName, isActive = true], i) => ({
    id: itemId,
    groupId: id,
    name: itemName,
    description: null,
    displayOrder: i,
    isActive,
  })),
  ...extra,
});

describe('resolveOptionSelections', () => {
  const salsas = group('salsas', 'Salsas', 0, [
    ['bbq', 'BBQ'],
    ['ajo', 'Ajo'],
    ['vieja', 'Vieja', false],
  ]);
  const tamano = group('tamano', 'Tamaño', 1, [
    ['m', 'Mediano'],
    ['l', 'Grande'],
  ]);
  const hielo = group('hielo', 'Hielo', 2, [['sin', 'Sin hielo']], {
    isActive: false,
  });
  const groups = [tamano, salsas, hielo];
  const offered = [
    { groupId: 'salsas', maxChoices: 2 },
    { groupId: 'tamano', maxChoices: 1 },
  ];
  const resolve = (picked: string[], offer = offered, all = groups) =>
    resolveOptionSelections(all, offer, picked, 'Burger');
  /** The business-rule error a call throws, or undefined. */
  const errorOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      const { code, message } = error as { code: string; message: string };
      return { code, message };
    }
    return undefined;
  };

  it("groups the picks in the groups' display order, with their names", () => {
    expect(resolve(['l', 'ajo', 'bbq'])).toEqual([
      {
        groupId: 'salsas',
        groupName: 'Salsas',
        itemIds: ['ajo', 'bbq'],
        itemNames: ['Ajo', 'BBQ'],
      },
      {
        groupId: 'tamano',
        groupName: 'Tamaño',
        itemIds: ['l'],
        itemNames: ['Grande'],
      },
    ]);
  });

  it('nothing picked, nothing required: no selections', () => {
    expect(resolve([])).toEqual([]);
  });

  it('counts a repeated pick once', () => {
    expect(resolve(['bbq', 'bbq'])[0].itemIds).toEqual(['bbq']);
  });

  it.each([
    ['an unknown option', ['nope'], 'ORDER_ITEM_INVALID_OPTION'],
    ['an inactive option', ['vieja'], 'ORDER_ITEM_INVALID_OPTION'],
    ['an option of a group that is off', ['sin'], 'ORDER_ITEM_INVALID_OPTION'],
    ['more than the product allows', ['m', 'l'], 'ORDER_ITEM_TOO_MANY_OPTIONS'],
  ])('rejects %s', (_label, picked, code) => {
    expect(errorOf(() => resolve(picked))?.code).toBe(code);
  });

  it("rejects an option of a group the product doesn't offer", () => {
    expect(
      errorOf(() => resolve(['m'], [{ groupId: 'salsas', maxChoices: 2 }])),
    ).toEqual({
      code: 'ORDER_ITEM_OPTION_NOT_OFFERED',
      message: 'Product "Burger" does not take tamaño',
    });
  });

  describe('a required group', () => {
    const required = { ...tamano, isRequired: true };

    it('needs a pick where the product offers it', () => {
      expect(
        errorOf(() => resolve(['bbq'], offered, [salsas, required]))?.code,
      ).toBe('ORDER_ITEM_OPTION_REQUIRED');
      expect(resolve(['m'], offered, [salsas, required])).toHaveLength(1);
    });

    it("isn't demanded where the product doesn't offer it", () => {
      expect(
        resolve([], [{ groupId: 'salsas', maxChoices: 2 }], [salsas, required]),
      ).toEqual([]);
    });

    it("isn't demanded when it has nothing active to pick", () => {
      const empty = {
        ...required,
        items: required.items.map((i) => ({ ...i, isActive: false })),
      };
      expect(resolve([], offered, [salsas, empty])).toEqual([]);
    });
  });
});
