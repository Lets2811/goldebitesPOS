import { useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useLinkableOrders } from '../../../modules/deliveries/hooks/use-deliveries';
import type { LinkableOrder } from '../../../modules/deliveries/types/delivery.types';
import { formatCOP } from '../../../utils/format';

const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/**
 * Searches the recent orders a delivery can be linked to (not cancelled and
 * without a delivery of their own), delivery orders first.
 */
export default function OrderPicker({
  value,
  onChange,
  label = 'Vincular a un pedido (opcional)',
  autoFocus,
}: {
  value: LinkableOrder | null;
  onChange: (order: LinkableOrder | null) => void;
  label?: string;
  autoFocus?: boolean;
}) {
  const [search, setSearch] = useState('');
  const { data: orders = [], isFetching } = useLinkableOrders(search, true);

  return (
    <Autocomplete<LinkableOrder>
      options={orders}
      value={value}
      loading={isFetching}
      onChange={(_e, order) => onChange(order)}
      onInputChange={(_e, text, reason) => {
        if (reason === 'input') setSearch(text);
      }}
      filterOptions={(all) => all}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText="No hay pedidos recientes sin domicilio"
      getOptionLabel={(o) => `#${o.orderNumber}${o.customerName ? ` · ${o.customerName}` : ''} · ${formatCOP(o.totalAmount)}`}
      renderOption={(props, o) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <Box component="li" key={key} {...rest}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                #{o.orderNumber} · {formatCOP(o.totalAmount)}
                {o.orderType === 'DELIVERY' ? ' · Domicilio' : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {[o.customerName, o.deliveryAddress, sameDay(o.createdAt) ? 'hoy' : 'días anteriores']
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder="Número, cliente o dirección" autoFocus={autoFocus} />
      )}
    />
  );
}
