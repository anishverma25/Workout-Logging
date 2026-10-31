import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './styles/index.css';
import { bootstrap } from './app/bootstrap';
import { registerServiceWorker } from './app/pwa';
import { router } from './app/router';
import { DatabaseScope } from './app/DatabaseScope';
import { ToastProvider } from './components/ui/Toast';
import { MoveToNewHome } from './app/layout/MoveToNewHome';
import { AppCrash } from './app/layout/AppCrash';
import { getAccountState, subscribeAccount } from './app/account';
import { markStage, markStarted, startupFailed } from './app/startup';
import { keepTapsWhileTyping } from './lib/tapThrough';

markStage('starting the app');
registerServiceWorker();
keepTapsWhileTyping();

// Drawn at once, not after start-up: while the account opens, the app shows its own opening
// mark, and a crash anywhere shows a way out instead of a blank screen.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppCrash>
      <ToastProvider>
        <DatabaseScope>
          <MoveToNewHome />
          <RouterProvider router={router} />
        </DatabaseScope>
      </ToastProvider>
    </AppCrash>
  </StrictMode>,
);

/**
 * The app counts as open once the router has drawn and the account is known (signed in, signed
 * out, or a build without accounts). Then the opening mark fades and the start-up check in
 * index.html stands down.
 */
function whenOpen() {
  const ready = () => router.state.initialized && getAccountState().status !== 'loading';
  const done = markStarted;
  if (ready()) return done();
  const stops: (() => void)[] = [];
  const check = () => {
    if (!ready()) return;
    stops.forEach((stop) => stop());
    done();
  };
  stops.push(router.subscribe(check), subscribeAccount(check));
}
whenOpen();

bootstrap().catch((err: unknown) => {
  console.error('Startup failed', err);
  startupFailed(err);
});
