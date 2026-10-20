import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import {
  ArrowUpDown,
  ChevronRight,
  FolderTree,
  ListChecks,
  Plus,
  QrCode,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import { Can } from '../../../modules/auth/components/can';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import { useProductCategories } from '../../../modules/product-categories/hooks/use-product-categories';
import { useProducts } from '../../../modules/products/hooks/use-products';
import { useOptionGroups } from '../../../modules/option-groups/hooks/use-option-groups';
import { isFeminineLabel } from '../../../modules/option-groups/utils/option-group-utils';
import type { OptionGroup } from '../../../modules/option-groups/types/option-group.types';
import { MODULE_PATHS, optionGroupPath } from '../../../routes/navConfig';
import { brand } from '../../../theme/palette';
import NewOptionGroupDialog from '../components/NewOptionGroupDialog';
import OptionGroupOrderDialog from '../components/OptionGroupOrderDialog';
import PublicMenuLinkDialog from '../components/PublicMenuLinkDialog';
import { useAllBranchesReview } from '../../../modules/auth/hooks/use-branch-mode';

interface HubCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Una cifra corta del estado actual ("32 productos · 30 activos"); undefined mientras carga. */
  stat?: string;
  onClick: () => void;
}

function HubCard({ icon: Icon, title, description, stat, onClick }: HubCardProps) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 2,
        p: 2.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        transition: 'border-color 120ms, background-color 120ms',
        '&:hover': {
          borderColor: alpha(brand.gold, 0.6),
          backgroundColor: alpha(brand.gold, 0.04),
        },
        '&:focus-visible': { outline: `2px solid ${brand.gold}` },
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(brand.gold, 0.12),
          color: brand.gold,
        }}
      >
        <Icon size={22} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {description}
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 1, fontWeight: 600, color: brand.gold }}
        >
          {stat ?? <Skeleton width={110} />}
        </Typography>
      </Box>
      <ChevronRight size={18} style={{ opacity: 0.5, marginTop: 12, flexShrink: 0 }} />
    </ButtonBase>
  );
}

function Group({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="overline" color="text.secondary">
          {title}
        </Typography>
        {action}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "3 salsas activas", "1 mezclador activo"; o "Apagado" si el negocio no lo usa. */
function groupStat(group: OptionGroup): string {
  if (!group.isActive) return 'Apagado: tócalo para activarlo';
  const active = group.items.filter((item) => item.isActive).length;
  const ending = isFeminineLabel(group.singularName) ? 'a' : 'o';
  return plural(
    active,
    `${group.singularName.toLocaleLowerCase('es')} activ${ending}`,
    `${group.name.toLocaleLowerCase('es')} activ${ending}s`,
  );
}

/**
 * Productos y recetas: la entrada con todo lo del catálogo y del menú del
 * cliente a la vista, en tarjetas con su estado actual. Cada una abre su
 * propia pantalla.
 */
export default function ProductsHubPage() {
  const reviewOnly = useAllBranchesReview();
  const navigate = useNavigate();
  const [menuLinkOpen, setMenuLinkOpen] = useState(false);
  const { data: currentBusiness } = useCurrentBusiness();
  const { data: productPage } = useProducts({ limit: 100 });
  const { data: categoryPage } = useProductCategories({ limit: 100 });
  const { groups: optionGroups, isLoading: groupsLoading } = useOptionGroups();
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  const products = productPage?.data;
  const productTotal = productPage?.meta?.total ?? products?.length ?? 0;
  const activeProducts = products?.filter((p) => p.isActive).length ?? 0;
  const builderProducts =
    products?.filter((p) => p.isActive && p.menuAvailability !== 'MENU').length ?? 0;
  const activeCategories = categoryPage?.data.filter((c) => c.isActive).length ?? 0;

  return (
    <>
      <PageHeader
        title="Productos y recetas"
        subtitle="Todo lo del catálogo y del menú que ve el cliente, en un solo lugar."
        breadcrumbs={[{ label: 'Productos y recetas' }]}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<QrCode size={16} />}
              onClick={() => setMenuLinkOpen(true)}
            >
              Compartir menú
            </Button>
            {/* A product is created at its branch, not from "Todas las sedes". */}
            {!reviewOnly && (
              <Can permission="products.create">
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => navigate(`${MODULE_PATHS.productsCatalog}?nuevo=1`)}
                >
                  Nuevo producto
                </Button>
              </Can>
            )}
          </Stack>
        }
      />

      <Stack spacing={4}>
        <Group title="Catálogo">
          <HubCard
            icon={UtensilsCrossed}
            title="Productos"
            description="Precios, recetas y qué opciones deja elegir cada producto."
            stat={
              products
                ? `${plural(productTotal, 'producto', 'productos')} · ${activeProducts} activos`
                : undefined
            }
            onClick={() => navigate(MODULE_PATHS.productsCatalog)}
          />
          <HubCard
            icon={FolderTree}
            title="Categorías"
            description="Las secciones en que se agrupan los productos."
            stat={
              categoryPage
                ? plural(activeCategories, 'categoría activa', 'categorías activas')
                : undefined
            }
            onClick={() => navigate(MODULE_PATHS.productsCategories)}
          />
        </Group>

        <Group title="Menú del cliente">
          <HubCard
            icon={ArrowUpDown}
            title="Organizar menú"
            description="Arrastra las secciones para ordenarlas como las ve el cliente, con vista previa."
            stat={categoryPage ? plural(activeCategories, 'sección', 'secciones') : undefined}
            onClick={() => navigate(MODULE_PATHS.productsMenuOrganizer)}
          />
          <HubCard
            icon={Sparkles}
            title="Arma tu combo"
            description="Lo que el cliente puede combinar a su gusto, y el orden de sus secciones."
            stat={
              products
                ? builderProducts > 0
                  ? `${plural(builderProducts, 'producto disponible', 'productos disponibles')}`
                  : 'Sin productos: márcalos en cada producto'
                : undefined
            }
            onClick={() => navigate(`${MODULE_PATHS.productsMenuOrganizer}?lista=combo`)}
          />
          <HubCard
            icon={QrCode}
            title="Compartir menú"
            description="El enlace y el código QR del menú público."
            stat="Abrir enlace y QR"
            onClick={() => setMenuLinkOpen(true)}
          />
        </Group>

        <Group
          title="Opciones para elegir"
          action={
            optionGroups.length > 1 && (
              <Can permission="products.update">
                <Button
                  size="small"
                  startIcon={<ArrowUpDown size={14} />}
                  onClick={() => setOrderOpen(true)}
                >
                  Ordenar
                </Button>
              </Can>
            )
          }
        >
          {optionGroups.map((group) => (
            <HubCard
              key={group.id}
              icon={ListChecks}
              title={group.name}
              description={`Lo que el cliente elige como "${group.name.toLocaleLowerCase('es')}"${
                group.isRequired ? ' (obligatorio)' : ''
              }. Cámbiale el nombre, las reglas y sus opciones.`}
              stat={groupsLoading ? undefined : groupStat(group)}
              onClick={() => navigate(optionGroupPath(group.id))}
            />
          ))}
          <Can permission="products.create">
            <HubCard
              icon={Plus}
              title="Nuevo grupo de opciones"
              description='Algo más que el cliente elige en algunos productos: "Tamaño", "Mezcladores", "Término"...'
              stat={
                groupsLoading
                  ? undefined
                  : plural(optionGroups.length, 'grupo creado', 'grupos creados')
              }
              onClick={() => setNewGroupOpen(true)}
            />
          </Can>
        </Group>
      </Stack>

      <PublicMenuLinkDialog
        open={menuLinkOpen}
        businessId={currentBusiness?.id}
        businessName={currentBusiness?.name}
        onClose={() => setMenuLinkOpen(false)}
      />
      <NewOptionGroupDialog
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onCreated={(group) => {
          setNewGroupOpen(false);
          navigate(optionGroupPath(group.id));
        }}
      />
      <OptionGroupOrderDialog
        open={orderOpen}
        groups={optionGroups}
        onClose={() => setOrderOpen(false)}
      />
    </>
  );
}
