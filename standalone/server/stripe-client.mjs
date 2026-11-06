import Stripe from 'stripe';
import { validateOrigin } from './request-security.mjs';

// Verified against stripe@23.1.0's generated API version. Keys never enter JSX.
export const STRIPE_API_VERSION = '2026-10-28.endive';
export function stripeConfiguration(env = process.env) {
  const mode = env.ELDRITCH_COMMERCE_MODE || 'disabled';
  if (!['disabled','sandbox'].includes(mode)) throw Error('Commerce supports disabled or sandbox mode only');
  const key = env.STRIPE_RESTRICTED_KEY || '';
  if (key && !/^(rk|sk)_test_\S+$/.test(key)) throw Error('Use a sandbox restricted API key; live keys are not supported');
  const config = {
    mode, origin: validateOrigin(env.ELDRITCH_ORIGIN), key,
    expectedAccount: env.ELDRITCH_STRIPE_ACCOUNT || '',
    shippingRate: env.STRIPE_SHIPPING_RATE_ID || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || ''
  };
  if (mode === 'sandbox' && (!key || !config.expectedAccount.startsWith('acct_') || !config.shippingRate.startsWith('shr_') || !config.webhookSecret.startsWith('whsec_'))) {
    throw Error('Sandbox commerce requires server key, expected account, shipping rate and webhook signing secret');
  }
  return config;
}
export function stripeClient(config) {
  return config.key ? new Stripe(config.key, {apiVersion:STRIPE_API_VERSION,maxNetworkRetries:2,timeout:10000}) : null;
}
