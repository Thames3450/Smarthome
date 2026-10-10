import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {applyTheme,getInitialTheme} from './lib/theme';
import './styles.css';
import './themes.css';
applyTheme(getInitialTheme());
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
