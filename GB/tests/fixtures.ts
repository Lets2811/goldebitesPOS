import { test as base } from '@playwright/test';
import { AppShell } from './pages/app-shell.page';
import { BranchPickerPage } from './pages/branch-picker.page';
import { ForcePasswordChangePage } from './pages/force-password-change.page';
import { LoginPage } from './pages/login.page';

type Pages = {
  loginPage: LoginPage;
  appShell: AppShell;
  forcePasswordChangePage: ForcePasswordChangePage;
  branchPickerPage: BranchPickerPage;
};

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  appShell: async ({ page }, use) => {
    await use(new AppShell(page));
  },
  forcePasswordChangePage: async ({ page }, use) => {
    await use(new ForcePasswordChangePage(page));
  },
  branchPickerPage: async ({ page }, use) => {
    await use(new BranchPickerPage(page));
  },
});

export { expect } from '@playwright/test';
