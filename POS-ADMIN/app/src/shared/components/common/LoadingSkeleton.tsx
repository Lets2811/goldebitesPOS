import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Grid from '@mui/material/Grid';

interface LoadingSkeletonProps {
  variant?: 'table' | 'cards' | 'list' | 'page';
  rows?: number;
}

export default function LoadingSkeleton({ variant = 'table', rows = 6 }: LoadingSkeletonProps) {
  if (variant === 'cards') {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: rows }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Skeleton variant="rounded" height={110} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (variant === 'list') {
    return (
      <Stack spacing={1.5}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
      </Stack>
    );
  }

  if (variant === 'page') {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={36} width="40%" />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={280} />
      </Stack>
    );
  }

  return (
    <Box>
      <Skeleton variant="rounded" height={44} sx={{ mb: 1 }} />
      <Stack spacing={1}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={40} />
        ))}
      </Stack>
    </Box>
  );
}
