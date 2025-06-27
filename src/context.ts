import { createContext } from 'react';
import { ToastMessage } from 'primereact/toast';

export const ToastContext = createContext<(toastMessage: ToastMessage) => void>(
    () => {}
);
