import React, { useRef } from 'react';
import 'primereact/resources/themes/lara-dark-amber/theme.css';
import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import './theme.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { InboxPage } from './pages/Inbox';
import { Toast, ToastMessage } from 'primereact/toast';
import { ToastContext } from './context';

export const App = () => {
    const toast = useRef<Toast>(null);

    const sendToast = (toastMessage: ToastMessage) => {
        toast.current?.show(toastMessage);
    };

    return (
        <>
            <ToastContext.Provider value={sendToast}>
                <BrowserRouter>
                    <Routes>
                        <Route index element={<InboxPage />} />
                    </Routes>
                </BrowserRouter>
                <Toast ref={toast} position="top-right" className="w-25rem" />
            </ToastContext.Provider>
        </>
    );
};
