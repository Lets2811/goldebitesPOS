import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <MuiBreadcrumbs
      separator={<ChevronRight size={14} />}
      sx={{ '& .MuiBreadcrumbs-li': { display: 'flex', alignItems: 'center' } }}
    >
      <Link
        component={RouterLink}
        to="/"
        underline="hover"
        color="text.secondary"
        sx={{ display: 'flex', alignItems: 'center' }}
      >
        <Home size={14} />
      </Link>
      {items.map((item, index) =>
        item.path && index !== items.length - 1 ? (
          <Link key={item.label} component={RouterLink} to={item.path} underline="hover" color="text.secondary">
            <Typography variant="body2">{item.label}</Typography>
          </Link>
        ) : (
          <Typography key={item.label} variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
            {item.label}
          </Typography>
        ),
      )}
    </MuiBreadcrumbs>
  );
}
