import { UnauthorizedOperationException } from '../../../common/exceptions';
import { AssistantInventoryService } from './assistant-inventory.service';

describe('AssistantInventoryService', () => {
  const businessId = 'business-1';
  const item = (id: string, branchId: string, minimumStock = 5) => ({
    id,
    name: `Item ${id}`,
    sku: null,
    unit: 'kg',
    isActive: true,
    minimumStock,
    branchId,
  });

  let inventoryItemsService: { findAll: jest.Mock; findOne: jest.Mock };
  let movementsService: { getStock: jest.Mock };
  let service: AssistantInventoryService;
  const scoped = {
    businessId,
    labelBranches: false,
    branchNames: new Map([
      ['b1', 'Centro'],
      ['b2', 'Norte'],
    ]),
    scope: { branch: null },
  };

  beforeEach(() => {
    inventoryItemsService = {
      findAll: jest.fn().mockResolvedValue({
        data: [item('papa', 'b1'), item('arroz', 'b1', 1)],
        meta: { total: 2 },
      }),
      findOne: jest.fn().mockResolvedValue(item('papa', 'b1')),
    };
    movementsService = {
      getStock: jest.fn().mockResolvedValue([
        // Papa: two locations at its branch, plus stock at another branch that is not its.
        { inventoryItemId: 'papa', branchId: 'b1', stock: 2 },
        { inventoryItemId: 'papa', branchId: 'b1', stock: 1.5 },
        { inventoryItemId: 'papa', branchId: 'b2', stock: 40 },
        { inventoryItemId: 'arroz', branchId: 'b1', stock: 8 },
      ]),
    };
    service = new AssistantInventoryService(
      inventoryItemsService as never,
      movementsService as never,
    );
  });

  it("searches the caller's branch items", async () => {
    await service.search({
      ...scoped,
      branchId: 'b1',
      search: 'pa',
      limit: 10,
    });

    expect(inventoryItemsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId,
        branchId: 'b1',
        search: 'pa',
        limit: 10,
      }),
    );
  });

  it('gives each item its stock at its own branch, and whether it is below its minimum', async () => {
    const result = await service.search({
      ...scoped,
      branchId: 'b1',
      limit: 10,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'papa',
        currentStock: 3.5,
        belowMinimum: true,
      }),
      expect.objectContaining({
        id: 'arroz',
        currentStock: 8,
        belowMinimum: false,
      }),
    ]);
    expect(result.total).toBe(2);
  });

  it("reads every branch's items, labelled with their branch, when asked for all", async () => {
    inventoryItemsService.findAll.mockResolvedValue({
      data: [item('papa', 'b1'), item('papa-norte', 'b2')],
      meta: { total: 2 },
    });

    const result = await service.search({
      ...scoped,
      branchId: null,
      labelBranches: true,
      limit: 10,
    });

    expect(inventoryItemsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: undefined }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'papa', branch: 'Centro' }),
      expect.objectContaining({ id: 'papa-norte', branch: 'Norte' }),
    ]);
  });

  it("refuses another branch's item to a user kept to their branch", async () => {
    await expect(service.findOne(businessId, 'papa', 'b2')).rejects.toThrow(
      UnauthorizedOperationException,
    );
  });

  it('reads one item with its stock', async () => {
    await expect(service.findOne(businessId, 'papa')).resolves.toMatchObject({
      id: 'papa',
      currentStock: 3.5,
    });
  });
});
