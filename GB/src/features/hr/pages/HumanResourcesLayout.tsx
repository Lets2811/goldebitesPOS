import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { Link as RouterLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import PageHeader from '../../../components/common/PageHeader';
import { MODULE_PATHS } from '../../../routes/navConfig';
import { useHrSections } from '../hooks/use-hr-sections';

/**
 * Recursos Humanos: Personal, Roles y permisos y Normas bajo una sola
 * entrada del menú. Cada pestaña es su propia ruta (protegida con su propio
 * permiso en AppRoutes), así que un enlace lleva directo a ella.
 */
export default function HumanResourcesLayout() {
  const location = useLocation();
  const sections = useHrSections();

  if (sections.length === 0) {
    return <Navigate to="/sin-acceso" replace state={{ from: location.pathname }} />;
  }

  // /recursos-humanos a secas abre la primera pestaña que el usuario puede ver.
  if (location.pathname === MODULE_PATHS.hr) {
    return <Navigate to={sections[0].path} replace />;
  }

  const current = sections.find((section) => location.pathname.startsWith(section.path));

  return (
    <>
      <PageHeader
        title="Recursos Humanos"
        subtitle="Equipo de trabajo, roles con sus permisos y normas del negocio."
        breadcrumbs={[
          { label: 'Recursos Humanos', path: MODULE_PATHS.hr },
          ...(current ? [{ label: current.label }] : []),
        ]}
      />

      <Tabs value={current?.path ?? false} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        {sections.map((section) => (
          <Tab
            key={section.path}
            value={section.path}
            label={section.label}
            component={RouterLink}
            to={section.path}
          />
        ))}
      </Tabs>

      <Outlet />
    </>
  );
}
