import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './mobile.css'
import './mobile-tokens.css'
import './app-mobile.css'
import './gameplay-layout.css'
import { AuthProvider } from './auth/AuthProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AuthProvider><App /></AuthProvider></React.StrictMode>,
)
