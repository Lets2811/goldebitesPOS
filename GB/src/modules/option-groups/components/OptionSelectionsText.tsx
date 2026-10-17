import type { OptionSelection } from '../types/option-group.types';
import { formatOptionSelections } from '../utils/option-group-utils';

/** "Salsas: BBQ · Tamaño: Grande", con los nombres que tenían el día del pedido. */
export default function OptionSelectionsText({ item }: { item: { optionSelections?: OptionSelection[] } }) {
  return <>{formatOptionSelections(item).join(' · ')}</>;
}
