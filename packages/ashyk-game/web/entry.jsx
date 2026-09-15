import React from 'react';
import {createRoot} from 'react-dom/client';
import {AshykGame} from './Game.jsx';
const roots=new WeakMap();
export function mountAshykGame(container,options={}){if(!container)throw new Error('Ashyk mount container is required');unmountAshykGame(container);const root=createRoot(container);roots.set(container,root);root.render(<AshykGame {...options}/>);return()=>unmountAshykGame(container);}
export function unmountAshykGame(container){const root=roots.get(container);if(!root)return false;root.unmount();roots.delete(container);return true;}
