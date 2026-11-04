// When the server refuses a page's data (403), the page should say so instead of looking empty.
// Returns the reason to show, or null when the response was not a refusal.
export const accessDeniedReason = async (res: Response): Promise<string | null> => {
  if (res.status !== 403) return null;
  const data = await res.json().catch(() => null);
  return typeof data?.detail === 'string' && data.detail.trim()
    ? data.detail
    : 'Your account is not allowed to see this information.';
};
