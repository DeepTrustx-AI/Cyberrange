export type FeedbackTone = 'success' | 'error' | 'info';

type FeedbackEventDetail = { message: string; tone?: FeedbackTone };
type ConfirmationOptions = { title?: string; confirmLabel?: string; destructive?: boolean };
type ConfirmationEventDetail = {
  message: string;
  options: ConfirmationOptions;
  resolve: (confirmed: boolean) => void;
};

const ALERT_EVENT = 'cyberrange:feedback';
const CONFIRM_EVENT = 'cyberrange:confirmation';

export const notify = (message: string, tone: FeedbackTone = 'info') => {
  window.dispatchEvent(new CustomEvent<FeedbackEventDetail>(ALERT_EVENT, { detail: { message, tone } }));
};

export const requestConfirmation = (message: string, options: ConfirmationOptions = {}): Promise<boolean> =>
  new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmationEventDetail>(CONFIRM_EVENT, {
      detail: { message, options, resolve },
    }));
  });

export const feedbackEvents = { ALERT_EVENT, CONFIRM_EVENT };
