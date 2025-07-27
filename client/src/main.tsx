
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css'; 
import App from './App'; 

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  console.error("Fatal Error: Root element not found in HTML.");
}