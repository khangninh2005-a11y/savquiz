import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Inject MathJax 3 configuration before it loads
const mathJaxScript = document.createElement('script');
mathJaxScript.innerHTML = `
  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
      displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
      processEscapes: true,
    },
    svg: { fontCache: 'global' },
    startup: { typeset: false },
  };
`;
document.head.appendChild(mathJaxScript);

const mj = document.createElement('script');
mj.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
mj.async = true;
document.head.appendChild(mj);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
