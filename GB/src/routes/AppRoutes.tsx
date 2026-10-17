import { Suspense, lazy } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import ProtectedRoute from './ProtectedRoute';
import PlatformAdminRoute from './PlatformAdminRoute';
import AuthProtectedRoute from '../modules/auth/components/protected-route';
import ForbiddenPage from './ForbiddenPage';
import NotFoundPage from './NotFoundPage';
import { LEGACY_PATH_REDIRECTS, MODULE_PATHS, MODULE_PERMISSIONS, isModuleDisabled } from './navConfig';
import { KIOSK_PATHS, KIOSK_PERMISSIONS } from './kioskConfig';

const LoginPage = lazy(() => import('../modules/auth/pages/LoginPage'));
const ForcePasswordChangePage = lazy(() => import('../modules/auth/pages/ForcePasswordChangePage'));
const PublicMenuPage = lazy(() => import('../features/public-menu/pages/PublicMenuPage'));
const NfcTableMenuPage = lazy(() => import('../features/public-menu/pages/NfcTableMenuPage'));

const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const OrdersPage = lazy(() => import('../features/orders/pages/OrdersPage'));
const OrdersBacklogPage = lazy(() => import('../features/orders/pages/OrdersBacklogPage'));
const KitchenPage = lazy(() => import('../features/kitchen/pages/KitchenPage'));
const CashRegisterPage = lazy(() => import('../features/cash-register/pages/CashRegisterPage'));
const ProductsPage = lazy(() => import('../features/products/pages/ProductsPage'));
const ProductsHubPage = lazy(() => import('../features/products/pages/ProductsHubPage'));
const ProductsSectionPage = lazy(() => import('../features/products/pages/ProductsSectionPage'));
const OptionGroupPage = lazy(() => import('../features/products/pages/OptionGroupPage'));
const InventoryPage = lazy(() => import('../features/inventory/pages/InventoryPage'));
const PurchasesPage = lazy(() => import('../features/purchases/pages/PurchasesPage'));
const SuppliersPage = lazy(() => import('../features/suppliers/pages/SuppliersPage'));
const CustomersPage = lazy(() => import('../features/customers/pages/CustomersPage'));
const LoyaltyPage = lazy(() => import('../features/loyalty/pages/LoyaltyPage'));
const FinancesPage = lazy(() => import('../features/finances/pages/FinancesPage'));
const EmployeesPage = lazy(() => import('../features/employees/pages/EmployeesPage'));
const HumanResourcesLayout = lazy(() => import('../features/hr/pages/HumanResourcesLayout'));
const HrSettingsPage = lazy(() => import('../features/hr/pages/HrSettingsPage'));
const RosterPage = lazy(() => import('../features/hr/pages/RosterPage'));
const TasksBoardPage = lazy(() => import('../features/hr/pages/TasksBoardPage'));
const LeaveRequestsPage = lazy(() => import('../features/hr/pages/LeaveRequestsPage'));
const MyProfilePage = lazy(() => import('../features/hr/pages/MyProfilePage'));
const ChecklistsPage = lazy(() => import('../features/checklists/pages/ChecklistsPage'));
const WastePage = lazy(() => import('../features/waste/pages/WastePage'));
const MaintenancePage = lazy(() => import('../features/maintenance/pages/MaintenancePage'));
const DocumentsPage = lazy(() => import('../features/documents/pages/DocumentsPage'));
const DocumentScansPage = lazy(() => import('../features/document-scans/pages/DocumentScansPage'));
const MarketingPage = lazy(() => import('../features/marketing/pages/MarketingPage'));
const AnalyticsPage = lazy(() => import('../features/analytics/pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('../features/settings/pages/SettingsPage'));
const BranchTablesNfcPage = lazy(() => import('../features/settings/pages/BranchTablesNfcPage'));
const RolesPage = lazy(() => import('../features/roles/pages/RolesPage'));
const PlatformAdminPage = lazy(() => import('../features/platform-admin/pages/PlatformAdminPage'));
const FeatureFlagsPage = lazy(() => import('../features/platform-admin/pages/FeatureFlagsPage'));
const WaiterKioskPage = lazy(() => import('../features/kiosk-waiter/pages/WaiterKioskPage'));
const KitchenKioskPage = lazy(() => import('../features/kiosk-kitchen/pages/KitchenKioskPage'));
const CarServiceKioskPage = lazy(() => import('../features/kiosk-car-service/pages/CarServiceKioskPage'));

function Loadable({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSkeleton variant="page" />}>{children}</Suspense>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Loadable>
            <LoginPage />
          </Loadable>
        }
      />
      <Route
        path="/menu/:businessId"
        element={
          <Loadable>
            <PublicMenuPage />
          </Loadable>
        }
      />
      <Route
        path="/m/:token"
        element={
          <Loadable>
            <NfcTableMenuPage />
          </Loadable>
        }
      />
      <Route element={<AuthProtectedRoute />}>
        <Route
          path="/cambiar-contrasena"
          element={
            <Loadable>
              <ForcePasswordChangePage />
            </Loadable>
          }
        />
        <Route element={<AppLayout />}>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.dashboard} />}>
            <Route
              path={MODULE_PATHS.dashboard}
              element={
                <Loadable>
                  <DashboardPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.orders} module="orders" />}>
            <Route
              path={MODULE_PATHS.orders}
              element={
                <Loadable>
                  <OrdersPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.ordersBacklog} module="orders" />}>
            <Route
              path={MODULE_PATHS.ordersBacklog}
              element={
                <Loadable>
                  <OrdersBacklogPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.kitchen} module="kitchen" />}>
            <Route
              path={MODULE_PATHS.kitchen}
              element={
                <Loadable>
                  <KitchenPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS['cash-register']} module="cash-register" />}>
            <Route
              path={MODULE_PATHS['cash-register']}
              element={
                <Loadable>
                  <CashRegisterPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.products} module="products" />}>
            <Route
              path={MODULE_PATHS.products}
              element={
                <Loadable>
                  <ProductsHubPage />
                </Loadable>
              }
            />
            <Route
              path={MODULE_PATHS.productsCatalog}
              element={
                <Loadable>
                  <ProductsPage />
                </Loadable>
              }
            />
            {(
              [
                [MODULE_PATHS.productsCategories, 'categorias'],
                [MODULE_PATHS.productsMenuOrganizer, 'organizar'],
              ] as const
            ).map(([path, section]) => (
              <Route
                key={path}
                path={path}
                element={
                  <Loadable>
                    <ProductsSectionPage section={section} />
                  </Loadable>
                }
              />
            ))}
            <Route
              path={MODULE_PATHS.productsOptionGroup}
              element={
                <Loadable>
                  <OptionGroupPage />
                </Loadable>
              }
            />
            {/* Old addresses of the two fixed option screens, now groups of their own. */}
            <Route path="/productos/salsas" element={<Navigate to={MODULE_PATHS.products} replace />} />
            <Route path="/productos/acompanantes" element={<Navigate to={MODULE_PATHS.products} replace />} />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.inventory} module="inventory" />}>
            <Route
              path={MODULE_PATHS.inventory}
              element={
                <Loadable>
                  <InventoryPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.purchases} module="purchases" />}>
            <Route
              path={MODULE_PATHS.purchases}
              element={
                <Loadable>
                  <PurchasesPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.suppliers} module="suppliers" />}>
            <Route
              path={MODULE_PATHS.suppliers}
              element={
                <Loadable>
                  <SuppliersPage />
                </Loadable>
              }
            />
          </Route>
          {/* Los módulos apagados (ver DISABLED_MODULES en navConfig) no tienen ruta: caen en NotFoundPage. */}
          {!isModuleDisabled('customers') && (
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.customers} module="customers" />}>
              <Route
                path={MODULE_PATHS.customers}
                element={
                  <Loadable>
                    <CustomersPage />
                  </Loadable>
                }
              />
            </Route>
          )}
          {!isModuleDisabled('loyalty') && (
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.loyalty} module="loyalty" />}>
              <Route
                path={MODULE_PATHS.loyalty}
                element={
                  <Loadable>
                    <LoyaltyPage />
                  </Loadable>
                }
              />
            </Route>
          )}
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.finances} module="finances" />}>
            <Route
              path={MODULE_PATHS.finances}
              element={
                <Loadable>
                  <FinancesPage />
                </Loadable>
              }
            />
          </Route>
          <Route
            path={MODULE_PATHS.hr}
            element={
              <Loadable>
                <HumanResourcesLayout />
              </Loadable>
            }
          >
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.employees} module="employees" />}>
              <Route
                path={MODULE_PATHS.employees}
                element={
                  <Loadable>
                    <EmployeesPage />
                  </Loadable>
                }
              />
            </Route>
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.employees} module="employees" />}>
              <Route
                path={MODULE_PATHS.hrRoster}
                element={
                  <Loadable>
                    <RosterPage />
                  </Loadable>
                }
              />
            </Route>
            <Route element={<ProtectedRoute permission="tasks.manage" module="hr" />}>
              <Route
                path={MODULE_PATHS.hrTasks}
                element={
                  <Loadable>
                    <TasksBoardPage />
                  </Loadable>
                }
              />
            </Route>
            <Route element={<ProtectedRoute permission="leave.approve" module="hr" />}>
              <Route
                path={MODULE_PATHS.hrLeave}
                element={
                  <Loadable>
                    <LeaveRequestsPage />
                  </Loadable>
                }
              />
            </Route>
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.roles} module="roles" />}>
              <Route
                path={MODULE_PATHS.roles}
                element={
                  <Loadable>
                    <RolesPage />
                  </Loadable>
                }
              />
            </Route>
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.hr} module="hr" />}>
              <Route
                path={MODULE_PATHS.hrRules}
                element={
                  <Loadable>
                    <HrSettingsPage />
                  </Loadable>
                }
              />
            </Route>
          </Route>
          {Object.entries(LEGACY_PATH_REDIRECTS).map(([from, to]) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}
          <Route element={<ProtectedRoute permission="hr.read" module="hr" />}>
            <Route
              path="/mi-perfil"
              element={
                <Loadable>
                  <MyProfilePage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.checklists} module="checklists" />}>
            <Route
              path={MODULE_PATHS.checklists}
              element={
                <Loadable>
                  <ChecklistsPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.waste} module="waste" />}>
            <Route
              path={MODULE_PATHS.waste}
              element={
                <Loadable>
                  <WastePage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.maintenance} module="maintenance" />}>
            <Route
              path={MODULE_PATHS.maintenance}
              element={
                <Loadable>
                  <MaintenancePage />
                </Loadable>
              }
            />
          </Route>
          {!isModuleDisabled('documents') && (
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.documents} module="documents" />}>
              <Route
                path={MODULE_PATHS.documents}
                element={
                  <Loadable>
                    <DocumentsPage />
                  </Loadable>
                }
              />
            </Route>
          )}
          {!isModuleDisabled('documentScans') && (
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.documentScans} module="documentScans" />}>
              <Route
                path={MODULE_PATHS.documentScans}
                element={
                  <Loadable>
                    <DocumentScansPage />
                  </Loadable>
                }
              />
            </Route>
          )}
          {!isModuleDisabled('marketing') && (
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.marketing} module="marketing" />}>
              <Route
                path={MODULE_PATHS.marketing}
                element={
                  <Loadable>
                    <MarketingPage />
                  </Loadable>
                }
              />
            </Route>
          )}
          {!isModuleDisabled('analytics') && (
            <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.analytics} module="analytics" />}>
              <Route
                path={MODULE_PATHS.analytics}
                element={
                  <Loadable>
                    <AnalyticsPage />
                  </Loadable>
                }
              />
            </Route>
          )}
          <Route element={<ProtectedRoute permission={MODULE_PERMISSIONS.settings} />}>
            <Route
              path={MODULE_PATHS.settings}
              element={
                <Loadable>
                  <SettingsPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<ProtectedRoute permission="branches.manage" />}>
            <Route
              path="/configuracion/sedes/:branchId/mesas-nfc"
              element={
                <Loadable>
                  <BranchTablesNfcPage />
                </Loadable>
              }
            />
          </Route>
          <Route element={<PlatformAdminRoute />}>
            <Route
              path="/plataforma"
              element={
                <Loadable>
                  <PlatformAdminPage />
                </Loadable>
              }
            />
            <Route
              path="/plataforma/feature-flags"
              element={
                <Loadable>
                  <FeatureFlagsPage />
                </Loadable>
              }
            />
          </Route>
          <Route path="/sin-acceso" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<ProtectedRoute permission={KIOSK_PERMISSIONS.waiter} />}>
          <Route
            path={KIOSK_PATHS.waiter}
            element={
              <Loadable>
                <WaiterKioskPage />
              </Loadable>
            }
          />
        </Route>
        <Route element={<ProtectedRoute permission={KIOSK_PERMISSIONS.kitchen} />}>
          <Route
            path={KIOSK_PATHS.kitchen}
            element={
              <Loadable>
                <KitchenKioskPage />
              </Loadable>
            }
          />
        </Route>
        <Route element={<ProtectedRoute permission={KIOSK_PERMISSIONS.carService} />}>
          <Route
            path={KIOSK_PATHS.carService}
            element={
              <Loadable>
                <CarServiceKioskPage />
              </Loadable>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
