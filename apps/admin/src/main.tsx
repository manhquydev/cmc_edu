import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

// Design tokens (CSS custom properties) registered once at the app root.
import '@cmc/ui/tokens.css';
import './app.css';

import { AppShell } from './app.tsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
  },
]);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
