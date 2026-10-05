import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles/index.css';
import { bootstrap } from './app/bootstrap';
import { router } from './app/router';
import { ThemeProvider } from './app/theme';
import { ToastProvider } from './components/ui/Toast';

const root = createRoot(document.getElementById('root')!);

function render() {
  root.render(
    <StrictMode>
      <ThemeProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

// Render even if bootstrapping fails, so screens can show their own error states.
bootstrap()
  .catch((err) => console.error('Startup failed', err))
  .finally(render);
