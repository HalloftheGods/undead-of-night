/** The page's single install controller and worker updater, created when the game loads so no early browser event is missed. */
import { createInstallController } from './install-controller.ts';
import { browserInstallEnv } from './browser-env.ts';
import { WORKER_URL, createUpdateHost, shouldRegisterWorker } from './worker-update.ts';

export const installController = createInstallController(browserInstallEnv(window));

const updateHost = createUpdateHost();

/** Called from main.ts. Does nothing on a dev server or where service workers are missing. */
export function startServiceWorker(): void {
  const supported = 'serviceWorker' in navigator;
  const allowed = shouldRegisterWorker({ production: import.meta.env.PROD, secure: window.isSecureContext, supported });
  if (!allowed) return;
  void updateHost.begin({
    container: navigator.serviceWorker,
    workerUrl: new URL(WORKER_URL, document.baseURI).href,
    reload: () => window.location.reload(),
  });
}

/** The first splash card calls this before the second one. A newer build found in that moment reloads before anyone sees it. */
export function checkForUpdateBeforeBoot(maxMs: number): Promise<void> {
  return updateHost.checkBeforeBoot(maxMs);
}

/** The title screen calls this as it mounts and unmounts. */
export function setTitleShowing(showing: boolean): void {
  updateHost.setTitleShowing(showing);
}
