import { SortOrder } from '../../../common/pagination/pagination-query.dto';
import { PaymentPolicy } from '../domain/branch.interface';
import { BranchesController } from './branches.controller';
import { BranchesService } from '../services/branches.service';

describe('BranchesController', () => {
  let service: jest.Mocked<
    Pick<
      BranchesService,
      'findAll' | 'findOne' | 'setTableCount' | 'setPaymentPolicy'
    >
  >;
  let controller: BranchesController;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      setTableCount: jest.fn(),
      setPaymentPolicy: jest.fn(),
    };
    controller = new BranchesController(service as unknown as BranchesService);
  });

  it('findAll() forwards pagination and filters', async () => {
    service.findAll.mockResolvedValue({ data: [], meta: {} } as never);

    await controller.findAll('business-1', {
      page: 2,
      limit: 10,
      sortOrder: SortOrder.DESC,
      isActive: true,
      search: 'norte',
    });

    expect(service.findAll).toHaveBeenCalledWith({
      businessId: 'business-1',
      page: 2,
      limit: 10,
      isActive: true,
      search: 'norte',
    });
  });

  it('findOne() looks up a single branch owned by the business', async () => {
    service.findOne.mockResolvedValue({ id: 'branch-1' } as never);

    await controller.findOne('business-1', 'branch-1');

    expect(service.findOne).toHaveBeenCalledWith('business-1', 'branch-1');
  });

  it('setTableCount() changes only the number of tables', async () => {
    service.setTableCount.mockResolvedValue({ id: 'branch-1' } as never);

    await controller.setTableCount('business-1', 'actor-1', 'branch-1', {
      tableCount: 12,
    });

    expect(service.setTableCount).toHaveBeenCalledWith(
      'business-1',
      'branch-1',
      12,
      'actor-1',
    );
  });

  it('offers a business no way to create, rename or deactivate its branches', () => {
    // Which branches exist is managed by the platform (PlatformAdminController).
    expect(controller).not.toHaveProperty('create');
    expect(controller).not.toHaveProperty('update');
    expect(controller).not.toHaveProperty('setStatus');
  });

  it('setPaymentPolicy() delegates with the actor id', async () => {
    service.setPaymentPolicy.mockResolvedValue({ id: 'branch-1' } as never);

    await controller.setPaymentPolicy('business-1', 'actor-1', 'branch-1', {
      paymentPolicy: PaymentPolicy.PREPAY_REQUIRED,
    });

    expect(service.setPaymentPolicy).toHaveBeenCalledWith(
      'business-1',
      'branch-1',
      PaymentPolicy.PREPAY_REQUIRED,
      'actor-1',
    );
  });
});
