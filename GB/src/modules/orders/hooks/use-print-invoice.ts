import { useAuthStore } from '../../auth/store/auth.store';
import { useCurrentBusiness } from '../../businesses/hooks/use-current-business';
import { useBusinessLogo } from '../../businesses/hooks/use-business-logo';
import { useTableNameMap } from '../../table-names/hooks/use-table-name-map';
import { ordersApi } from '../api/orders.api';
import { printElectronicInvoice, printInvoice } from '../utils/print-invoice';
import type { ElectronicInvoice } from '../../e-invoicing/types/e-invoicing.types';
import type { OrderWithItems } from '../types/order.types';
import type { Payment } from '../types/payment.types';

export function usePrintInvoice() {
  const { data: business } = useCurrentBusiness();
  const { data: logo } = useBusinessLogo();
  const branchId = useAuthStore((s) => s.user?.branchId);
  const tableNames = useTableNameMap(branchId);
  const options = {
    businessName: business?.name,
    businessLogo: logo,
    legalName: business?.legalName,
    taxId: business?.taxId,
    phone: business?.phone,
    tableNames,
  };

  return {
    /** Imprime de inmediato con los datos ya cargados en memoria (botón manual). */
    printNow(order: OrderWithItems, payments: Payment[]) {
      printInvoice(order, payments, options);
    },
    /** La factura electrónica: el mismo ticket con número DIAN, CUFE y QR. */
    printElectronic(order: OrderWithItems, payments: Payment[], invoice: ElectronicInvoice) {
      return printElectronicInvoice(order, payments, invoice, options);
    },
    /** Trae el pedido y sus pagos más recientes del servidor antes de imprimir (auto-impresión tras un pago). */
    async printByOrderId(orderId: string) {
      const [order, payments] = await Promise.all([
        ordersApi.getOrder(orderId),
        ordersApi.getPayments(orderId),
      ]);
      printInvoice(order, payments, options);
    },
  };
}
