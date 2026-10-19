import { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import PageHeader from '../../../components/common/PageHeader';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import DeliveriesList from '../components/DeliveriesList';
import DeliveryPlanner from '../components/DeliveryPlanner';
import DeliverySettingsPanel from '../components/DeliverySettingsPanel';
import ShareTrackingDialog from '../components/ShareTrackingDialog';
import TrackingPanel from '../components/TrackingPanel';
import type { Delivery } from '../../../modules/deliveries/types/delivery.types';

type DeliveriesTab = 'new' | 'list' | 'tracking' | 'settings';

/**
 * Domicilios: plan a delivery on the map (route, distance and fee), follow
 * the day's deliveries and their couriers, and set the pricing and where
 * each branch is.
 */
export default function DeliveriesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('deliveries.manage');
  const canConfigure = hasPermission('deliveries.configure');
  const [tab, setTab] = useState<DeliveriesTab>(canManage ? 'new' : 'list');
  /** The delivery just created: its tracking link is offered to send to the customer. */
  const [created, setCreated] = useState<Delivery | null>(null);

  return (
    <>
      <PageHeader
        title="Domicilios"
        subtitle="Ruta y valor por distancia desde cada sede, y quién lleva cada domicilio."
        breadcrumbs={[{ label: 'Operación diaria' }, { label: 'Domicilios' }]}
      />
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}>
        <Tabs value={tab} onChange={(_e, value: DeliveriesTab) => setTab(value)}>
          {canManage && <Tab value="new" label="Nuevo domicilio" />}
          <Tab value="list" label="Domicilios" />
          <Tab value="tracking" label="Seguimiento" />
          {canConfigure && <Tab value="settings" label="Tarifa y sedes" />}
        </Tabs>
      </Box>
      {tab === 'new' && canManage && (
        <DeliveryPlanner
          onCreated={(delivery) => {
            setCreated(delivery);
            setTab('list');
          }}
        />
      )}
      {tab === 'list' && <DeliveriesList />}
      {tab === 'tracking' && <TrackingPanel />}
      {tab === 'settings' && canConfigure && <DeliverySettingsPanel />}
      <ShareTrackingDialog delivery={created} justCreated onClose={() => setCreated(null)} />
    </>
  );
}
