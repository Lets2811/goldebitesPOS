import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/common/PageHeader';
import { MODULE_PATHS } from '../../../routes/navConfig';
import MenuOrganizerTab from '../components/MenuOrganizerTab';
import ProductCategoriesTab from '../components/ProductCategoriesTab';

export type ProductsSection = 'categorias' | 'organizar';

const SECTIONS: Record<ProductsSection, { title: string; subtitle: string }> = {
  categorias: {
    title: 'Categorías',
    subtitle: 'Las secciones en que se agrupan los productos del menú.',
  },
  organizar: {
    title: 'Organizar menú',
    subtitle: 'El orden de las secciones que ve el cliente, en el menú y en "Arma tu combo".',
  },
};

/** Una de las herramientas de Productos y recetas en su propia pantalla, con el camino de vuelta a la entrada. */
export default function ProductsSectionPage({ section }: { section: ProductsSection }) {
  const [searchParams] = useSearchParams();
  const { title, subtitle } = SECTIONS[section];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        backTo={{ label: 'Productos y recetas', path: MODULE_PATHS.products }}
      />
      {section === 'categorias' && <ProductCategoriesTab />}
      {section === 'organizar' && (
        <MenuOrganizerTab initialScope={searchParams.get('lista') === 'combo' ? 'BUILDER' : 'MENU'} />
      )}
    </>
  );
}
