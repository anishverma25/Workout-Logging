import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './styles/index.css';
import { bootstrap } from './app/bootstrap';
import { registerServiceWorker } from './app/pwa';
import { router } from './app/router';
import { DatabaseScope } from './app/DatabaseScope';
import { ToastProvider } from './components/ui/Toast';

const root = createRoot(document.getElementById('root')!);

function render() {
  root.render(
    <StrictMode>
      <ToastProvider>
        <DatabaseScope>
          <RouterProvider router={router} />
        </DatabaseScope>
      </ToastProvider>
    </StrictMode>,
  );
}

registerServiceWorker();

// Render even if bootstrapping fails, so screens can show their own error states.
bootstrap()
  .catch((err) => console.error('Startup failed', err))
  .finally(render);
