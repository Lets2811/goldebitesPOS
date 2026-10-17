import { useMemo, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Popper from '@mui/material/Popper';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { Menu as MenuIcon, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../../store/uiStore';
import SearchInput from '../common/SearchInput';
import NotificationsMenu from './NotificationsMenu';
import UserMenu from './UserMenu';
import BackendHealthIndicator from './BackendHealthIndicator';
import EnvironmentChip from '../common/EnvironmentChip';
import { searchGlobal } from '../../services/globalSearch';

export default function Header() {
  const setMobileOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const [query, setQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const results = useMemo(() => searchGlobal(query), [query]);
  const open = query.trim().length >= 2;

  return (
    <AppBar position="sticky" elevation={0} color="transparent">
      <Toolbar sx={{ gap: 1.5 }}>
        <IconButton
          onClick={() => setMobileOpen(true)}
          sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.secondary' }}
        >
          <MenuIcon size={20} />
        </IconButton>

        <Box ref={setAnchorEl} sx={{ flex: 1, maxWidth: 440 }}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar pedidos, productos, clientes..."
            fullWidth
          />
        </Box>
        <Popper
          open={open}
          anchorEl={anchorEl}
          placement="bottom-start"
          sx={{ zIndex: 1300, width: 440 }}
        >
          <ClickAwayListener onClickAway={() => setQuery('')}>
            <Paper sx={{ mt: 0.75, maxHeight: 360, overflowY: 'auto' }}>
              {results.length === 0 ? (
                <Box
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: 'text.secondary',
                  }}
                >
                  <Search size={16} />
                  <Typography variant="body2">Sin resultados para "{query}"</Typography>
                </Box>
              ) : (
                results.map((result, index) => (
                  <Box key={result.id}>
                    {index > 0 && <Divider />}
                    <Box
                      onClick={() => {
                        navigate(result.path);
                        setQuery('');
                      }}
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.hover' },
                      }}
                    >
                      <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                        {result.group}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {result.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {result.subtitle}
                      </Typography>
                    </Box>
                  </Box>
                ))
              )}
            </Paper>
          </ClickAwayListener>
        </Popper>

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <EnvironmentChip />
          <BackendHealthIndicator />
          <NotificationsMenu />
          <UserMenu />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
