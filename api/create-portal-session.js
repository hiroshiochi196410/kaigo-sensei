import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { subscription_id } = req.body || {};
    if (!subscription_id) return res.status(400).json({ error: 'subscription_id is required' });

    const subscription = await stripe.subscriptions.retrieve(subscription_id);
    const customer = subscription.customer;

    const returnUrl =
      process.env.SITE_URL ||
      (req.headers.origin ? req.headers.origin : 'https://example.com');

    const portalSession = await stripe.billingPortal.sessions.create({
      customer,
      return_url: returnUrl
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (e) {
    console.error('create-portal-session error:', e);
    return res.status(500).json({ error: e.message || 'server error' });
  }
}
