import Box from '@mui/material/Box';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import DeliveryHelpAlerts from '../../features/deliveries/components/DeliveryHelpAlerts';
import AllBranchesReviewBanner from './AllBranchesReviewBanner';

export default function AppLayout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <Box
          component="main"
          sx={{ flex: 1, p: { xs: 2, sm: 3 }, maxWidth: 1600, width: '100%', mx: 'auto' }}
        >
          {/* Calls from deliveries sound on every screen: no one watches Domicilios all the time. */}
          <DeliveryHelpAlerts />
          <AllBranchesReviewBanner />
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
