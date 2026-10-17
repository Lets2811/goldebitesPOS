import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { HR_SECTIONS, type HrSection } from '../../../routes/navConfig';

/** Las pestañas de Recursos Humanos que el usuario puede abrir: permiso real del JWT y módulo activo en el negocio. */
export function useHrSections(): HrSection[] {
  const { hasPermission, hasFeature } = usePermissions();
  return HR_SECTIONS.filter((section) => hasPermission(section.permission) && hasFeature(section.module));
}
