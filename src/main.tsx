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

const root = createRoot(document.getElementById('root')!);

function render() {
  root.render(
    <StrictMode>
      <ToastProvider>
        <DatabaseScope>
          <MoveToNewHome />
          <RouterProvider router={router} />
        </DatabaseScope>
      </ToastProvider>
    </StrictMode>,
  );
}

registerServiceWorker();

/** Fades out the opening mark in index.html once the app has drawn its first screen. */
function hideBoot() {
  const boot = document.getElementById('boot');
  if (!boot || boot.classList.contains('out')) return;
  boot.classList.add('out');
  window.setTimeout(() => boot.remove(), 250);
}

function whenDrawn() {
  const done = () => requestAnimationFrame(() => requestAnimationFrame(hideBoot));
  if (router.state.initialized) return done();
  const stop = router.subscribe((s) => {
    if (!s.initialized) return;
    stop();
    done();
  });
}

// Whatever happens, the opening mark never stays up for long.
window.setTimeout(hideBoot, 8000);

// Render even if bootstrapping fails, so screens can show their own error states.
bootstrap()
  .catch((err) => console.error('Startup failed', err))
  .finally(() => {
    render();
    whenDrawn();
  });
