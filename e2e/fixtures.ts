import { test as base } from '@playwright/test';

import { type Account, newAccount, signUpWithOrganization } from './support/accounts';
import { Api } from './support/api';

interface Fixtures {
  // a fresh user with their own organization, already signed in on `page`
  account: Account;
  // seeds data as that user
  api: Api;
}

export const test = base.extend<Fixtures>({
  account: async ({ page }, use) => {
    const account = newAccount();
    // page.request shares the page's cookies, so the session it receives signs the page in
    await signUpWithOrganization(page.request, account);
    await use(account);
  },

  api: async ({ page, account: _account }, use) => {
    await use(new Api(page.request));
  },
});

export { expect } from '@playwright/test';
