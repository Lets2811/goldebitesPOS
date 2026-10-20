import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { useState } from 'react';
import ButtonBase from '@mui/material/ButtonBase';
import { ArrowLeftRight, ChevronsLeft, ChevronsRight, Crown } from 'lucide-react';
import BranchSwitchDialog from '../../modules/branches/components/BranchSwitchDialog';
import { useLocation } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import { MODULE_PERMISSIONS, NAV_ENTRIES } from '../../routes/navConfig';
import { usePermissions } from '../../modules/auth/hooks/use-permissions';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../modules/auth/store/auth.store';
import { useBranches } from '../../modules/branches/hooks/use-branches';
import { useBusinessLogo } from '../../modules/businesses/hooks/use-business-logo';
import { useCurrentBusiness } from '../../modules/businesses/hooks/use-current-business';
import { brand } from '../../theme/palette';
import { useHrSections } from '../../features/hr/hooks/use-hr-sections';
import SidebarItem from './SidebarItem';

export const SIDEBAR_WIDTH_EXPANDED = 264;
export const SIDEBAR_WIDTH_COLLAPSED = 76;

/**
 * Dónde está trabajando el usuario, para la etiqueta junto al nombre del
 * negocio. Un negocio con una sola sede no tiene "sedes" que nombrar: es la
 * principal. Con varias, es la sede del usuario, o todas si no tiene una
 * asignada (quien administra el negocio completo).
 */
function useBranchLabel(): string | null {
  const branchId = useAuthStore((s) => s.user?.branchId ?? null);
  const { data } = useBranches({ isActive: true, limit: 50 });
  const branches = data?.data;

  if (!branches) return null;
  if (branches.length <= 1) return 'Principal';
  return branches.find((branch) => branch.id === branchId)?.name ?? 'Todas las sedes';
}

/** Whether the business has more than one active branch: only then is there one to switch to or compare. */
function useHasSeveralBranches(): boolean {
  const { data } = useBranches({ isActive: true, limit: 50 });
  return (data?.data.length ?? 0) > 1;
}

function BrandHeader({ collapsed }: { collapsed: boolean }) {
  const { data: business } = useCurrentBusiness();
  const { data: logo } = useBusinessLogo();
  const branchLabel = useBranchLabel();
  const { hasPermission } = usePermissions();
  const hasSeveralBranches = useHasSeveralBranches();
  const canSwitch = hasPermission('branches.switch') && hasSeveralBranches;
  const [switchOpen, setSwitchOpen] = useState(false);

  return (
    <>
      <Stack
        direction="row"

        spacing={1.25}
        sx={{ alignItems: 'center', px: collapsed ? 1.5 : 2.5, py: 2.5, overflow: 'hidden' }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            // El marco dorado es de la corona; un logo propio va sobre su propio fondo.
            backgroundColor: logo ? 'transparent' : alpha(brand.gold, 0.14),
            color: brand.gold,
            border: logo ? 'none' : `1px solid ${alpha(brand.gold, 0.4)}`,
          }}
        >
          {/* La corona es el logo por defecto: la reemplaza el que el negocio suba en Configuración. */}
          {logo ? (
            <Box
              component="img"
              src={logo}
              alt={business?.name ? `Logo de ${business.name}` : 'Logo del negocio'}
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Crown size={18} strokeWidth={2} />
          )}
        </Box>
        {!collapsed && (
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              noWrap
              sx={{ fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.25 }}
            >
              {business?.name ?? '—'}
            </Typography>
            {/* Debajo del nombre y no a su lado: un nombre largo de negocio o de sede no cabría en una sola línea. */}
            {branchLabel && (
              <Tooltip title="Sede en la que estás trabajando" placement="right">
                <Typography
                  component="span"
                  noWrap
                  sx={{
                    display: 'inline-block',
                    maxWidth: '100%',
                    mt: 0.25,
                    px: 0.75,
                    py: 0.125,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    verticalAlign: 'top',
                    color: brand.gold,
                    backgroundColor: alpha(brand.gold, 0.12),
                    border: `1px solid ${alpha(brand.gold, 0.35)}`,
                    borderRadius: 1,
                  }}
                >
                  {branchLabel}
                </Typography>
              </Tooltip>
            )}
            {canSwitch && (
              <ButtonBase
                onClick={() => setSwitchOpen(true)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 0.75,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                  '&:hover': { color: brand.gold, backgroundColor: alpha(brand.gold, 0.08) },
                }}
              >
                <ArrowLeftRight size={13} />
                Cambiar de sede
              </ButtonBase>
            )}
          </Box>
        )}
      </Stack>
      {collapsed && canSwitch && (
        <Stack sx={{ alignItems: 'center', mt: -1.5, mb: 1 }}>
          <Tooltip title="Cambiar de sede" placement="right">
            <IconButton
              size="small"
              onClick={() => setSwitchOpen(true)}
              sx={{ color: 'text.secondary' }}
            >
              <ArrowLeftRight size={16} />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
      <BranchSwitchDialog open={switchOpen} onClose={() => setSwitchOpen(false)} />
    </>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { hasPermission, hasAnyPermission, hasFeature } = usePermissions();
  const location = useLocation();
  const toggleCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);
  const hrSections = useHrSections();
  const hasSeveralBranches = useHasSeveralBranches();

  const can = (module: keyof typeof MODULE_PERMISSIONS): boolean => {
    // Recursos Humanos reúne varios módulos: basta con poder abrir una de sus pestañas.
    if (module === 'hr') return hrSections.length > 0;
    // Comparar necesita más de una sede.
    if (module === 'branchComparison' && !hasSeveralBranches) return false;
    const required = MODULE_PERMISSIONS[module];
    const hasRequiredPermission = Array.isArray(required)
      ? hasAnyPermission(required)
      : hasPermission(required);
    return hasRequiredPermission && hasFeature(module);
  };

  // Una entrada sigue marcada en sus subrutas (las pestañas de Recursos Humanos).
  const isActive = (path: string): boolean =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <BrandHeader collapsed={collapsed} />
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: collapsed ? 1 : 1.5 }}>
        <List
          component="nav"
          disablePadding
          sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
        >
          {NAV_ENTRIES.map((entry) => {
            if (entry.kind === 'item') {
              if (!can(entry.module)) return null;
              return (
                <SidebarItem
                  key={entry.path}
                  item={entry}
                  collapsed={collapsed}
                  active={isActive(entry.path)}
                  onNavigate={onNavigate}
                />
              );
            }
            const visibleItems = entry.items.filter((item) => can(item.module));
            if (visibleItems.length === 0) return null;
            return (
              <Box key={entry.label} sx={{ mt: 1 }}>
                {!collapsed && (
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ pl: 1.5, display: 'block', fontSize: '0.68rem' }}
                  >
                    {entry.label}
                  </Typography>
                )}
                {visibleItems.map((item) => (
                  <SidebarItem
                    key={item.path}
                    item={item}
                    collapsed={collapsed}
                    active={isActive(item.path)}
                    onNavigate={onNavigate}
                  />
                ))}
              </Box>
            );
          })}
        </List>
      </Box>
      <Stack sx={{ alignItems: collapsed ? 'center' : 'flex-end', p: 1.25 }}>
        <Tooltip title={collapsed ? 'Expandir menú' : 'Colapsar menú'} placement="right">
          <IconButton
            size="small"
            onClick={toggleCollapsed}
            sx={{ color: 'text.secondary', display: { xs: 'none', md: 'inline-flex' } }}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

export default function Sidebar() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const width = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' } }}
        slotProps={{
          paper: {
            sx: { width: SIDEBAR_WIDTH_EXPANDED, borderRight: '1px solid', borderColor: 'divider' },
          },
        }}
      >
        <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          transition: (theme) => theme.transitions.create('width'),
          '& .MuiDrawer-paper': {
            width,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            overflowX: 'hidden',
            transition: (theme) => theme.transitions.create('width'),
          },
        }}
      >
        <SidebarContent collapsed={sidebarCollapsed} />
      </Drawer>
    </>
  );
}
