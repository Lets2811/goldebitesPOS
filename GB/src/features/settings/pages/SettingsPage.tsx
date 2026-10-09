import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import { ChevronDown, Check, X, Upload, Trash2, Nfc } from 'lucide-react';
import { useSnackbar } from 'notistack';
import PageHeader from '../../../components/common/PageHeader';
import StatusChip from '../../../components/common/StatusChip';
import { Can } from '../../../modules/auth/components/can';
import { HasFeature } from '../../../modules/auth/components/has-feature';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import { useUpdateBusiness } from '../../../modules/businesses/hooks/use-update-business';
import { useBusinessLogo } from '../../../modules/businesses/hooks/use-business-logo';
import { useUploadBusinessLogo } from '../../../modules/businesses/hooks/use-upload-business-logo';
import { useDeleteBusinessLogo } from '../../../modules/businesses/hooks/use-delete-business-logo';
import { useUpdateTaxRate } from '../../../modules/settings/hooks/use-update-tax-rate';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import BranchTableCountField from '../components/BranchTableCountField';
import TuraLinksSection from '../components/TuraLinksSection';
import { useProductCategories } from '../../../modules/product-categories/hooks/use-product-categories';
import { useCreateProductCategory } from '../../../modules/product-categories/hooks/use-create-product-category';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useSettingsStore } from '../../../store/settingsStore';
import { useUiStore } from '../../../store/uiStore';
import { PAYMENT_METHOD_LABELS, type PaymentMethod, type Channel, CHANNEL_LABELS } from '../../../types/common';
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE } from '../../../modules/orders/order-status';

export default function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const themeMode = useUiStore((s) => s.themeMode);
  const toggleThemeMode = useUiStore((s) => s.toggleThemeMode);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);
  const { enqueueSnackbar } = useSnackbar();

  const { data: business } = useCurrentBusiness();
  const updateBusiness = useUpdateBusiness();
  const { data: logoDataUri, isLoading: logoLoading } = useBusinessLogo();
  const uploadLogo = useUploadBusinessLogo();
  const deleteLogo = useDeleteBusinessLogo();
  const updateTaxRate = useUpdateTaxRate();
  const { data: branchesData } = useBranches({ limit: 50 });
  const branches = branchesData?.data ?? [];
  const { data: categoriesData } = useProductCategories({ limit: 100 });
  const categories = categoriesData?.data ?? [];
  const createCategory = useCreateProductCategory();
  const [newCategoryName, setNewCategoryName] = useState('');

  const [businessForm, setBusinessForm] = useState({
    name: '',
    legalName: '',
    taxId: '',
    phone: '',
    email: '',
  });
  const [taxRatePercent, setTaxRatePercent] = useState('0');

  // Re-seed the form fields once the business loads (derived during render, not an effect).
  const [loadedBusinessId, setLoadedBusinessId] = useState<string | null>(null);
  if (business && business.id !== loadedBusinessId) {
    setLoadedBusinessId(business.id);
    setBusinessForm({
      name: business.name,
      legalName: business.legalName ?? '',
      taxId: business.taxId ?? '',
      phone: business.phone ?? '',
      email: business.email ?? '',
    });
    setTaxRatePercent(String(Math.round(business.taxRate * 100)));
  }

  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadLogo.mutate(file, {
      onSuccess: () => enqueueSnackbar('Logo actualizado correctamente', { variant: 'success' }),
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
    });
  };

  return (
    <>
      <PageHeader title="Configuración" subtitle="Parámetros generales del negocio y del sistema." breadcrumbs={[{ label: 'Configuración' }]} />

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ChevronDown size={18} />}>
          <Typography sx={{ fontWeight: 700 }}>Información del negocio</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <TextField
              label="Nombre comercial"
              value={businessForm.name}
              onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
            />
            <TextField
              label="Razón social"
              value={businessForm.legalName}
              onChange={(e) => setBusinessForm({ ...businessForm, legalName: e.target.value })}
            />
            <TextField
              label="NIT"
              value={businessForm.taxId}
              onChange={(e) => setBusinessForm({ ...businessForm, taxId: e.target.value })}
            />
            <TextField
              label="Teléfono"
              value={businessForm.phone}
              onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })}
            />
            <TextField
              label="Correo"
              value={businessForm.email}
              onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
            />
            <Can permission="businesses.manage">
              <Button
                variant="contained"
                sx={{ alignSelf: 'flex-start' }}
                loading={updateBusiness.isPending}
                onClick={() => {
                  updateBusiness.mutate(businessForm, {
                    onSuccess: () => enqueueSnackbar('Información del negocio actualizada', { variant: 'success' }),
                    onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                  });
                }}
              >
                Guardar cambios
              </Button>
            </Can>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Logo del negocio
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Se incluye en las comandas de cocina, facturas y comprobantes de pago que imprime la app.
              </Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 2,
                    border: '1px dashed',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    bgcolor: 'action.hover',
                    flexShrink: 0,
                  }}
                >
                  {logoLoading ? (
                    <Typography variant="caption" color="text.secondary">
                      ...
                    </Typography>
                  ) : logoDataUri ? (
                    <Box component="img" src={logoDataUri} alt="Logo del negocio" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', px: 0.5 }}>
                      Sin logo
                    </Typography>
                  )}
                </Box>
                <Can permission="businesses.manage">
                  <Stack spacing={1}>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={handleLogoSelected}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Upload size={14} />}
                      loading={uploadLogo.isPending}
                      onClick={() => logoInputRef.current?.click()}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {logoDataUri ? 'Cambiar logo' : 'Subir logo'}
                    </Button>
                    {logoDataUri && (
                      <Button
                        size="small"
                        color="error"
                        startIcon={<Trash2 size={14} />}
                        loading={deleteLogo.isPending}
                        onClick={() => {
                          deleteLogo.mutate(undefined, {
                            onSuccess: () => enqueueSnackbar('Logo eliminado', { variant: 'success' }),
                            onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                          });
                        }}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Quitar logo
                      </Button>
                    )}
                  </Stack>
                </Can>
              </Stack>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ChevronDown size={18} />}>
          <Typography sx={{ fontWeight: 700 }}>{branches.length > 1 ? 'Sedes: mesas y NFC' : 'Mesas y NFC'}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            {/* Which branches exist is the platform's to manage (they are a contracted add-on); here only what running one needs. */}
            {branches.length > 1 && (
              <Typography variant="caption" color="text.secondary">
                Las sedes de tu negocio las administra el proveedor del POS. Aquí configuras las mesas y las etiquetas NFC
                de cada una.
              </Typography>
            )}
            {branches.map((branch) => (
              <Stack key={branch.id} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                {/* A single branch is just "the business": naming it would only raise the question of what a branch is. */}
                {branches.length > 1 ? (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {branch.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[branch.address, branch.city, branch.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Mesas del negocio
                  </Typography>
                )}
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Can permission="branches.manage">
                    <BranchTableCountField branch={branch} />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Nfc size={16} />}
                      onClick={() => navigate(`/configuracion/sedes/${branch.id}/mesas-nfc`)}
                    >
                      Administrar mesas y NFC
                    </Button>
                  </Can>
                  {branches.length > 1 && (
                    <StatusChip
                      label={branch.isActive ? 'Activa' : 'Inactiva'}
                      tone={branch.isActive ? 'success' : 'neutral'}
                    />
                  )}
                </Stack>
              </Stack>
            ))}
            {branches.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No hay sedes registradas.
              </Typography>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ChevronDown size={18} />}>
          <Typography sx={{ fontWeight: 700 }}>Impuestos, pagos y canales de venta</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <TextField
                label="Tasa de impuesto (%)"
                type="number"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(e.target.value)}
                sx={{ maxWidth: 220 }}
              />
              <Can permission="settings.manage">
                <Button
                  variant="outlined"
                  loading={updateTaxRate.isPending}
                  onClick={() => {
                    const rate = Number(taxRatePercent) / 100;
                    updateTaxRate.mutate(rate, {
                      onSuccess: () => enqueueSnackbar('Tasa de impuesto actualizada', { variant: 'success' }),
                      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                    });
                  }}
                >
                  Guardar
                </Button>
              </Can>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Los métodos de pago y canales de venta habilitados son preferencias locales de la interfaz — el
              backend no modela esta configuración todavía.
            </Typography>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Métodos de pago habilitados (local)
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    onClick={() => settings.togglePaymentMethod(value)}
                    color={settings.paymentMethodsEnabled.includes(value) ? 'primary' : 'default'}
                    variant={settings.paymentMethodsEnabled.includes(value) ? 'filled' : 'outlined'}
                    icon={settings.paymentMethodsEnabled.includes(value) ? <Check size={14} /> : <X size={14} />}
                  />
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Canales de venta habilitados (local)
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {(Object.entries(CHANNEL_LABELS) as [Channel, string][]).map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    onClick={() => settings.toggleChannel(value)}
                    color={settings.channelsEnabled.includes(value) ? 'primary' : 'default'}
                    variant={settings.channelsEnabled.includes(value) ? 'filled' : 'outlined'}
                    icon={settings.channelsEnabled.includes(value) ? <Check size={14} /> : <X size={14} />}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ChevronDown size={18} />}>
          <Typography sx={{ fontWeight: 700 }}>Catálogo y estados</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Estados de pedido
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {ORDER_STATUS_SEQUENCE.map((status) => (
                  <Chip key={status} label={ORDER_STATUS_LABELS[status]} variant="outlined" size="small" />
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Categorías de productos
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1.5 }}>
                {categories.map((cat) => (
                  <Chip key={cat.id} label={cat.name} variant="outlined" size="small" />
                ))}
                {categories.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No hay categorías registradas.
                  </Typography>
                )}
              </Stack>
              <Can permission="products.create">
                <Stack direction="row" spacing={1} sx={{ maxWidth: 360 }}>
                  <TextField
                    size="small"
                    label="Nueva categoría"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    loading={createCategory.isPending}
                    disabled={!newCategoryName.trim()}
                    onClick={() => {
                      createCategory.mutate(
                        { name: newCategoryName.trim() },
                        {
                          onSuccess: () => {
                            enqueueSnackbar('Categoría creada', { variant: 'success' });
                            setNewCategoryName('');
                          },
                          onError: (error) =>
                            enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                        },
                      );
                    }}
                  >
                    Añadir
                  </Button>
                </Stack>
              </Can>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* TURA is a paid module: the section only exists for businesses a platform admin has given it to. */}
      <HasFeature feature="tura">
        <Can permission="settings.manage">
          <TuraLinksSection />
        </Can>
      </HasFeature>

      <Accordion>
        <AccordionSummary expandIcon={<ChevronDown size={18} />}>
          <Typography sx={{ fontWeight: 700 }}>Preferencias visuales</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            <FormControlLabel
              control={<Switch checked={themeMode === 'dark'} onChange={toggleThemeMode} />}
              label="Tema oscuro"
            />
            <FormControlLabel
              control={<Switch checked={sidebarCollapsed} onChange={toggleSidebarCollapsed} />}
              label="Menú lateral colapsado por defecto"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </>
  );
}
