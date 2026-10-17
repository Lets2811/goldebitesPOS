import { ConflictException } from '../../../common/exceptions';
import { OptionGroupsService } from './option-groups.service';

describe('OptionGroupsService', () => {
  let repository: Record<string, jest.Mock>;
  let auditService: { record: jest.Mock };
  let service: OptionGroupsService;

  const groupRow = (id: string, name: string, displayOrder: number) => ({
    id,
    business_id: 'b1',
    name,
    singular_name: name.replace(/s$/, ''),
    is_active: true,
    is_required: false,
    default_max: 1,
    display_order: displayOrder,
    created_at: new Date(),
    updated_at: new Date(),
  });
  const itemRow = (id: string, groupId: string, name: string) => ({
    id,
    business_id: 'b1',
    group_id: groupId,
    name,
    description: null,
    display_order: 0,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });

  beforeEach(() => {
    repository = {
      findGroups: jest.fn().mockResolvedValue([]),
      findItems: jest.fn().mockResolvedValue([]),
      findGroupById: jest.fn(),
      findItemById: jest.fn(),
      groupNameTaken: jest.fn().mockResolvedValue(false),
      itemNameTaken: jest.fn().mockResolvedValue(false),
      createGroup: jest.fn(),
      updateGroup: jest.fn(),
      countOwnedGroups: jest.fn(),
      setGroupOrder: jest.fn(),
      createItem: jest.fn(),
      updateItem: jest.fn(),
      findProductGroups: jest.fn().mockResolvedValue([]),
      replaceProductGroups: jest.fn(),
      deleteGroup: jest.fn().mockResolvedValue(true),
      deleteItem: jest.fn().mockResolvedValue(true),
    };
    auditService = { record: jest.fn() };
    service = new OptionGroupsService(
      repository as never,
      auditService as never,
    );
  });

  it('lists each group with its own options', async () => {
    repository.findGroups.mockResolvedValue([
      groupRow('g1', 'Salsas', 0),
      groupRow('g2', 'Mezcladores', 1),
    ]);
    repository.findItems.mockResolvedValue([
      itemRow('i1', 'g1', 'BBQ'),
      itemRow('i2', 'g2', 'Soda'),
      itemRow('i3', 'g1', 'Ajo'),
    ]);

    const groups = await service.findAll('b1');

    expect(groups.map((g) => [g.name, g.items.map((i) => i.name)])).toEqual([
      ['Salsas', ['BBQ', 'Ajo']],
      ['Mezcladores', ['Soda']],
    ]);
  });

  it('creates a group with trimmed names, refusing a name already used', async () => {
    repository.createGroup.mockResolvedValue(groupRow('g1', 'Tamaños', 0));

    await service.createGroup({
      businessId: 'b1',
      name: ' Tamaños ',
      singularName: 'Tamaño ',
    });

    expect(repository.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tamaños', singularName: 'Tamaño' }),
    );

    repository.groupNameTaken.mockResolvedValue(true);
    await expect(
      service.createGroup({
        businessId: 'b1',
        name: 'Tamaños',
        singularName: 'Tamaño',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('only reorders with every group listed exactly once', async () => {
    repository.findGroups.mockResolvedValue([
      groupRow('g1', 'A', 0),
      groupRow('g2', 'B', 1),
    ]);

    await expect(service.setGroupOrder('b1', ['g2'])).rejects.toMatchObject({
      code: 'OPTION_GROUP_ORDER_MISMATCH',
    });
    await expect(
      service.setGroupOrder('b1', ['g2', 'g2']),
    ).rejects.toMatchObject({
      code: 'OPTION_GROUP_ORDER_MISMATCH',
    });

    await service.setGroupOrder('b1', ['g2', 'g1']);
    expect(repository.setGroupOrder).toHaveBeenCalledWith('b1', ['g2', 'g1']);
  });

  it('keys the groups each product offers by product', async () => {
    repository.findProductGroups.mockResolvedValue([
      { product_id: 'p1', group_id: 'g1', max_choices: 2 },
      { product_id: 'p1', group_id: 'g2', max_choices: 1 },
      { product_id: 'p2', group_id: 'g1', max_choices: 1 },
    ]);

    const byProduct = await service.getProductGroups(['p1', 'p2', 'p3']);

    expect(byProduct.get('p1')).toEqual([
      { groupId: 'g1', maxChoices: 2 },
      { groupId: 'g2', maxChoices: 1 },
    ]);
    expect(byProduct.get('p3')).toBeUndefined();
  });

  it("refuses a product's groups that repeat or belong to another business", async () => {
    await expect(
      service.assertProductGroupsValid('b1', [
        { groupId: 'g1', maxChoices: 1 },
        { groupId: 'g1', maxChoices: 2 },
      ]),
    ).rejects.toMatchObject({ code: 'PRODUCT_OPTION_GROUP_DUPLICATED' });

    repository.countOwnedGroups.mockResolvedValue(0);
    await expect(
      service.assertProductGroupsValid('b1', [
        { groupId: 'foreign', maxChoices: 1 },
      ]),
    ).rejects.toMatchObject({ code: 'PRODUCT_OPTION_GROUP_UNKNOWN' });
  });

  it('deletes a group and records what it took away', async () => {
    repository.findGroups.mockResolvedValue([
      { ...groupRow('g1', 'Tamaños', 0), product_count: '3' },
    ]);
    repository.findItems.mockResolvedValue([itemRow('i1', 'g1', 'Grande')]);

    await service.deleteGroup('b1', 'g1', 'actor-1');

    expect(repository.deleteGroup).toHaveBeenCalledWith('b1', 'g1');
    const [audit] = auditService.record.mock.calls[0] as [
      { action: string; oldValues: Record<string, unknown> },
    ];
    expect(audit.action).toBe('DELETE');
    expect(audit.oldValues).toEqual({
      name: 'Tamaños',
      items: ['Grande'],
      productCount: 3,
    });
  });

  it("refuses to delete a group or option that isn't the business's", async () => {
    await expect(service.deleteGroup('b1', 'foreign')).rejects.toMatchObject({
      code: expect.any(String) as string,
    });
    expect(repository.deleteGroup).not.toHaveBeenCalled();

    repository.findItemById.mockResolvedValue(null);
    await expect(
      service.deleteItem('b1', 'g1', 'foreign'),
    ).rejects.toBeDefined();
    expect(repository.deleteItem).not.toHaveBeenCalled();
  });

  it('deletes one option', async () => {
    repository.findItemById.mockResolvedValue(itemRow('i1', 'g1', 'Grande'));

    await service.deleteItem('b1', 'g1', 'i1');

    expect(repository.deleteItem).toHaveBeenCalledWith('b1', 'g1', 'i1');
  });
});
