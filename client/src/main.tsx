import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Bootstrap comes first so index.css can override it where needed.
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
