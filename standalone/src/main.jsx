import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Storefront from './pages/Storefront.jsx';
import Adventure from './pages/Adventure.jsx';
import { Account, AccountHome } from './pages/Account.jsx';
import { AccountRecovery, EmailVerification, VerificationRecovery } from './pages/AccountRecovery.jsx';
import NewsletterAction from './pages/NewsletterAction.jsx';
import './styles/accounts.css';
const client = new QueryClient();
createRoot(document.getElementById('root')).render(
  <React.StrictMode><QueryClientProvider client={client}><BrowserRouter><Routes>
    <Route path="/login" element={<Account key="login" mode="login" />} />
    <Route path="/register" element={<Account key="register" mode="register" />} />
    <Route path="/account" element={<AccountHome />} />
    <Route path="/play" element={<Adventure key="play" />} />
    <Route path="/stash" element={<Adventure key="stash" stash />} />
    <Route path="/forgot-password" element={<AccountRecovery key="request" mode="request" />} />
    <Route path="/reset-password" element={<AccountRecovery key="reset" mode="reset" />} />
    <Route path="/verify-email" element={<EmailVerification />} />
    <Route path="/resend-verification" element={<VerificationRecovery />} />
    <Route path="/admin" element={<AccountHome admin />} />
    <Route path="/newsletter/confirm" element={<NewsletterAction action="confirm" />} />
    <Route path="/newsletter/unsubscribe" element={<NewsletterAction action="unsubscribe" />} />
    <Route path="/*" element={<Storefront />} />
  </Routes></BrowserRouter></QueryClientProvider></React.StrictMode>
);
