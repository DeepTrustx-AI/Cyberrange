const CHECKOUT_SDK = 'https://checkout.razorpay.com/v1/checkout.js';

let loading: Promise<void> | null = null;

// Razorpay's checkout script, loaded when a payment starts instead of on every
// page: as a blocking tag in index.html it held up the whole app on a slow link,
// and it ran on the sign-in page too.
export function ensureRazorpay(): Promise<void> {
  if ((window as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SDK;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Failed to load the Razorpay checkout script.'));
    };
    document.body.appendChild(script);
  });
  return loading;
}
