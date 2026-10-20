import { useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Fab from '@mui/material/Fab';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useSnackbar } from 'notistack';
import { ChevronRight, ShoppingCart, Sparkles, UtensilsCrossed } from 'lucide-react';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import ErrorState from '../../../components/common/ErrorState';
import StatusChip from '../../../components/common/StatusChip';
import { usePublicMenu } from '../../../modules/public-menu/hooks/use-public-menu';
import type { PublicMenuProduct } from '../../../modules/public-menu/types/public-menu.types';
import { useSubmitNfcOrder } from '../../../modules/public-nfc-orders/hooks/use-submit-nfc-order';
import type { PublicNfcOrder } from '../../../modules/public-nfc-orders/types/public-nfc-order.types';
import { normalizeApiError } from '../../../lib/api/api-error';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '../../../modules/orders/order-status';
import type { OrderStatus } from '../../../modules/orders/types/order.types';
import { formatCOP } from '../../../utils/format';
import { brand } from '../../../theme/palette';
import ComboBuilderDialog from './ComboBuilderDialog';
import ProductDetailDialog from './ProductDetailDialog';
import PublicCartDrawer from './PublicCartDrawer';
import { usePublicCart } from '../hooks/use-public-cart';

interface PublicMenuBrowserProps {
  businessId: string | undefined;
  /** The branch whose menu to show (the table's); absent, the business's. */
  branchId?: string;
  /** Whether the generic "Menú" heading under the business name should render — off when a caller (e.g. the NFC page) already shows its own context header above this. */
  showMenuLabel?: boolean;
  /** Present only from the NFC-scanned flow (/m/:token) — absent here means the generic preview, which never offers "Confirmar pedido". */
  token?: string;
  orderType?: 'DINE_IN' | 'TAKEAWAY';
  /**
   * Menú solo de consulta: se puede ver cada producto, pero no hay forma de
   * agregarlo ni carrito. Lo usa una mesa sin autoservicio, donde el pedido
   * lo toma el mesero.
   */
  readOnly?: boolean;
}

/**
 * The shared catalog-browsing + cart experience — categories, products,
 * product customization, and the local cart. Used as-is by the generic
 * preview (`/menu/:businessId`, no branch/table context) and wrapped with a
 * fixed-table context header by the NFC gallo page (`/m/:token`).
 */
export default function PublicMenuBrowser({
  businessId,
  branchId,
  showMenuLabel = true,
  token,
  orderType,
  readOnly = false,
}: PublicMenuBrowserProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: menu, isLoading, isError } = usePublicMenu(businessId, branchId);
  const [selectedProduct, setSelectedProduct] = useState<PublicMenuProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<PublicNfcOrder | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const {
    cart,
    addToCart,
    addComboToCart,
    increment,
    decrement,
    remove,
    clear,
    itemCount,
    total,
    idempotencyKey,
  } = usePublicCart();
  const submitOrder = useSubmitNfcOrder(token);

  function handleSubmit() {
    if (!token || !orderType) return;
    submitOrder.mutate(
      {
        orderType,
        idempotencyKey,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          optionItemIds: line.optionItemIds.length > 0 ? line.optionItemIds : undefined,
          // Cocina ve qué productos van juntos en un mismo combo armado.
          notes: line.comboNumber ? `Arma tu combo ${line.comboNumber}` : undefined,
        })),
      },
      {
        onSuccess: (order) => {
          setActiveOrder(order);
          clear();
          setCartOpen(false);
          enqueueSnackbar(`Pedido #${order.orderNumber} confirmado`, { variant: 'success' });
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  }

  return (
    <Box sx={{ pb: 12 }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        {isLoading && <LoadingSkeleton variant="page" />}

        {isError && (
          <ErrorState
            title="Menú no disponible"
            description="No pudimos cargar este menú. Verifica el enlace o intenta más tarde."
          />
        )}

        {menu && (
          <>
            <Stack sx={{ alignItems: 'center', textAlign: 'center', mb: 5 }} spacing={1}>
              <UtensilsCrossed size={28} color={brand.gold} strokeWidth={1.75} />
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0.3 }}>
                {menu.businessName}
              </Typography>
              {showMenuLabel && (
                <Typography variant="body2" color="text.secondary">
                  Menú
                </Typography>
              )}
            </Stack>

            {activeOrder && (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 4,
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: brand.gold,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Pedido #{activeOrder.orderNumber}
                </Typography>
                <StatusChip
                  label={
                    ORDER_STATUS_LABELS[activeOrder.status as OrderStatus] ?? activeOrder.status
                  }
                  tone={ORDER_STATUS_TONE[activeOrder.status as OrderStatus]}
                />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {formatCOP(activeOrder.totalAmount)}
                </Typography>
              </Stack>
            )}

            {!readOnly &&
              menu.builderCategories.some((category) => category.products.length > 0) && (
                <ButtonBase
                  onClick={() => setBuilderOpen(true)}
                  sx={{
                    width: '100%',
                    mb: 4,
                    p: 2,
                    gap: 2,
                    borderRadius: 2,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    border: '1px solid',
                    borderColor: brand.gold,
                    background: `linear-gradient(135deg, ${brand.gold}22, transparent 70%)`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${brand.gold}33, transparent 70%)`,
                    },
                  }}
                >
                  <Sparkles size={28} color={brand.gold} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Arma tu combo
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Escoge lo que quieras, a tu gusto y a tu estilo.
                    </Typography>
                  </Box>
                  <ChevronRight size={22} color={brand.gold} />
                </ButtonBase>
              )}

            {menu.categories.length === 0 && (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
                Todavía no hay productos disponibles en el menú.
              </Typography>
            )}

            <Stack spacing={5}>
              {menu.categories.map((category) => (
                <Box key={category.id ?? 'uncategorized'}>
                  <Typography
                    variant="overline"
                    sx={{ color: brand.gold, fontWeight: 700, letterSpacing: 1.5 }}
                  >
                    {category.name}
                  </Typography>
                  <Divider sx={{ mb: 2, mt: 0.5, borderColor: brand.gold, opacity: 0.3 }} />
                  <Stack spacing={0.5}>
                    {category.products.map((product) => (
                      <ButtonBase
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        sx={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          py: 1.25,
                          borderRadius: 1.5,
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            flexShrink: 0,
                            borderRadius: 2,
                            overflow: 'hidden',
                            bgcolor: 'action.hover',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {product.imageUrl ? (
                            <Box
                              component="img"
                              src={product.imageUrl}
                              alt={product.name}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <UtensilsCrossed size={22} color={brand.gold} strokeWidth={1.5} />
                          )}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {product.name}
                          </Typography>
                          {product.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {product.description}
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          {formatCOP(product.salePrice)}
                        </Typography>
                      </ButtonBase>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </>
        )}
      </Box>

      {!readOnly && itemCount > 0 && (
        <Fab
          color="primary"
          variant="extended"
          onClick={() => setCartOpen(true)}
          sx={{ position: 'fixed', bottom: 24, right: 24, fontWeight: 700, boxShadow: 4 }}
        >
          <Badge badgeContent={itemCount} color="secondary" sx={{ mr: 2 }}>
            <ShoppingCart size={20} />
          </Badge>
          {formatCOP(total)}
        </Fab>
      )}

      <ProductDetailDialog
        product={selectedProduct}
        optionGroups={menu?.optionGroups ?? []}
        onAdd={addToCart}
        onClose={() => setSelectedProduct(null)}
        readOnly={readOnly}
      />

      <ComboBuilderDialog
        open={builderOpen && !readOnly}
        categories={menu?.builderCategories ?? []}
        optionGroups={menu?.optionGroups ?? []}
        onClose={() => setBuilderOpen(false)}
        onAddCombo={(units) => {
          addComboToCart(units);
          // El carrito abierto es la confirmación: se ve el combo dentro del pedido, listo para enviar.
          setCartOpen(true);
        }}
      />

      <PublicCartDrawer
        open={cartOpen && !readOnly}
        cart={cart}
        optionGroups={menu?.optionGroups ?? []}
        total={total}
        onIncrement={increment}
        onDecrement={decrement}
        onRemove={remove}
        onClose={() => setCartOpen(false)}
        onSubmit={token && orderType ? handleSubmit : undefined}
        submitting={submitOrder.isPending}
      />
    </Box>
  );
}
