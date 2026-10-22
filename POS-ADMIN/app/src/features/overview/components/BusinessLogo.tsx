import Avatar from '@mui/material/Avatar';
import { useBusinessLogo } from '../../../modules/overview/overview';
import { initialsFromName } from '../../../shared/utils/format';
import { brand } from '../../../shared/theme/palette';

/** A business's logo, or its initials while it loads or when it has none. */
export default function BusinessLogo({
  business,
  size = 56,
}: {
  business: { id: string; name: string; hasLogo: boolean };
  size?: number;
}) {
  const logo = useBusinessLogo(business.id, business.hasLogo);
  return (
    <Avatar
      src={logo ?? undefined}
      alt={business.name}
      variant="rounded"
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        fontWeight: 800,
        bgcolor: logo ? '#fff' : 'action.selected',
        color: brand.gold,
        '& img': { objectFit: 'contain', p: 0.5 },
      }}
    >
      {initialsFromName(business.name)}
    </Avatar>
  );
}
