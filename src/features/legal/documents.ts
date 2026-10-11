import { OWNER_NAME, SUPPORT_EMAIL } from './contact';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDocument {
  slug: 'terms' | 'privacy' | 'refunds' | 'contact';
  title: string;
  /** Short name for footer links. */
  label: string;
  summary: string;
  sections: LegalSection[];
}

export const TERMS: LegalDocument = {
  slug: 'terms',
  title: 'Terms and conditions',
  label: 'Terms',
  summary: 'The rules for using Overload, in plain language.',
  sections: [
    {
      heading: 'About these terms',
      paragraphs: [
        `Overload is a workout logging app run by ${OWNER_NAME} in India ("we", "us"). By creating an account or using Overload you agree to these terms and to our Privacy policy and Cancellation and refund policy. If you do not agree, please do not use the app.`,
      ],
    },
    {
      heading: 'Using Overload',
      items: [
        'You can use the free features without an account. Your data then stays on your device.',
        'An account needs a real email address. You are responsible for keeping your password safe and for what happens under your account.',
        'If you are under 18, use Overload with the permission of a parent or guardian.',
        'Do not misuse the app: no attempts to break it, scrape it, resell it or get around its limits.',
      ],
    },
    {
      heading: 'Fitness information, not medical advice',
      paragraphs: [
        'Overload shows numbers and suggestions from what you log. They are for general fitness use and are not medical advice. Check with a doctor before starting a new training or diet plan, and stop if something hurts. You train at your own risk.',
      ],
    },
    {
      heading: 'Pro, trials and payments',
      items: [
        'New accounts get a 7 day free trial of Pro. It needs no payment details.',
        'Pro is sold as a monthly, 3 month or yearly plan. The prices in Indian rupees are shown on the Pro page when you subscribe.',
        'Prices on the Pro page can be introductory prices. We may change prices for new subscriptions in the future.',
        'A subscription renews automatically at the end of each period until you cancel it.',
        'You can also pay once for a period of Pro. A one-time payment does not renew, and each one adds that period to the Pro time you have left.',
        'Payments are handled by Razorpay. We never see or store your card number or UPI PIN.',
        'Pro turns on as soon as your payment is confirmed.',
      ],
    },
    {
      heading: 'Cancelling and refunds',
      paragraphs: [
        'You can cancel any time from the Pro page. Pro stays on until the end of the period you have paid for. Our Cancellation and refund policy explains the details, including that payments are not refunded except where we made a mistake.',
      ],
    },
    {
      heading: 'Your data',
      paragraphs: [
        'What you log is yours. You can export it as CSV files from Settings and delete your account from the Account page. Our Privacy policy explains what we keep and why.',
      ],
    },
    {
      heading: 'Changes to the app and these terms',
      paragraphs: [
        'We may add, change or remove features, and we may update these terms. When we make an important change we will show a notice in the app. Using Overload after a change means you accept it.',
      ],
    },
    {
      heading: 'Our responsibility',
      paragraphs: [
        'We work to keep Overload running and accurate, but it is provided as it is, without a promise that it will always be available or free of errors. To the extent the law allows, we are not responsible for indirect or consequential loss, and our total responsibility to you is limited to the amount you paid us in the 12 months before the problem.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: ['These terms are governed by the laws of India.'],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about these terms: ${SUPPORT_EMAIL}.`],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy policy',
  label: 'Privacy',
  summary: 'What Overload keeps, why, and how you can remove it.',
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        `Overload is run by ${OWNER_NAME} in India. This page explains what personal data the app handles and what you can do about it.`,
      ],
    },
    {
      heading: 'Without an account',
      paragraphs: [
        'You can use Overload without an account. Your workouts, routines, profile and photos are then stored only on your device, in the browser. We do not receive them.',
      ],
    },
    {
      heading: 'With an account',
      paragraphs: [
        'When you create an account, we store the following on our servers so it can sync between your devices:',
      ],
      items: [
        'Your email address and your password. The password is stored in scrambled form by our sign in provider, so we cannot read it.',
        'Your profile: name, sex, height, goal, experience, training days, session length, equipment and activity level.',
        'Your routines, workouts, sets, body weight, body measurements and goals.',
        'Messages you send us through the feedback page.',
        'Your Pro status and the plan you chose.',
      ],
    },
    {
      heading: 'Progress photos',
      paragraphs: ['Progress photos stay on your phone. They are never uploaded to our servers.'],
    },
    {
      heading: 'Payments',
      paragraphs: [
        'Payments are processed by Razorpay. Razorpay collects your card, UPI or bank details directly. We never see or store them. We receive only the plan, the payment status and Razorpay reference numbers for your subscription and payments.',
      ],
    },
    {
      heading: 'How we use your data',
      items: [
        'To run the app, keep your data in sync and show your progress.',
        'To turn Pro on and manage your subscription.',
        'To answer your messages and fix problems.',
      ],
      paragraphs: [
        'We do not sell your data. We do not show ads. We do not use third party analytics or tracking in the app.',
      ],
    },
    {
      heading: 'Who handles it for us',
      paragraphs: [
        'We use a small number of providers to run Overload: Supabase for the database and sign in, Cloudflare to host the app, and Razorpay for payments. They process data only to provide those services. Their servers may be in other countries.',
      ],
    },
    {
      heading: 'Keeping and deleting your data',
      items: [
        'You can export your workouts and body data as CSV files from Settings.',
        'You can delete your account from the Account page. This removes your account and the data stored with it on our servers.',
        'We may keep limited payment records for as long as the law requires.',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        `You can see and correct your data in the app. You can ask us for a copy, a correction or a deletion by writing to ${SUPPORT_EMAIL}. We will reply as soon as we can.`,
      ],
    },
    {
      heading: 'Security',
      paragraphs: [
        'Data is sent over encrypted connections, and each account can reach only its own data. No online service is perfectly secure, so please use a strong password that you do not use anywhere else.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        `Overload is not aimed at children. If you believe a child has given us data without a parent's permission, write to ${SUPPORT_EMAIL} and we will delete it.`,
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'If we change this policy in an important way, we will show a notice in the app and update the date at the top of this page.',
      ],
    },
  ],
};

export const REFUNDS: LegalDocument = {
  slug: 'refunds',
  title: 'Cancellation and refund policy',
  label: 'Cancellation and refunds',
  summary: 'How to cancel Pro, and when a payment can be refunded.',
  sections: [
    {
      heading: 'Free trial',
      paragraphs: [
        'New accounts get 7 days of Pro for free, with no payment details. Nothing is charged, so there is nothing to refund.',
      ],
    },
    {
      heading: 'Cancel any time',
      items: [
        'Open the Pro page in the app, find your plan and choose Cancel plan. A plan you paid for once does not renew, so there is nothing to cancel.',
        'There is no cancellation fee.',
        'Pro stays on until the end of the period you have already paid for. After that it ends and you are not charged again.',
        'To avoid the next charge, cancel before your renewal date.',
      ],
    },
    {
      heading: 'No refunds',
      paragraphs: [
        'Payments for Pro are not refundable. This includes the unused part of a period, and monthly, 3 month and yearly plans alike. You keep Pro until the end of the period you paid for.',
      ],
    },
    {
      heading: 'When we make a mistake',
      paragraphs: [
        'If you were charged twice for the same period, or charged and Pro did not turn on, write to us within 7 days at the address below. We will fix it, or refund the charge that should not have happened.',
        'Approved refunds are sent back to the same card, UPI account or bank account you paid with. They usually reach you within 5 to 7 working days, depending on your bank.',
      ],
    },
    {
      heading: 'If a renewal fails',
      paragraphs: [
        'If a renewal payment cannot be collected, Razorpay may try again. If it still cannot be collected, your plan stops and Pro ends when the period you paid for is over.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        `For billing questions, write to ${SUPPORT_EMAIL}. Please include the email you used to sign up.`,
      ],
    },
  ],
};

export const CONTACT: LegalDocument = {
  slug: 'contact',
  title: 'Contact us',
  label: 'Contact',
  summary: 'How to reach the person who builds Overload.',
  sections: [
    {
      heading: 'What to write to us about',
      items: [
        'Billing, plans and refund questions.',
        'Problems with your account or with signing in.',
        'Bugs and ideas. You can also use the feedback page inside the app.',
        'Requests about your data, such as a copy or a deletion.',
      ],
    },
    {
      heading: 'Reply time',
      paragraphs: [
        'We aim to reply within 2 working days. Please include the email you signed up with so we can find your account.',
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: LegalDocument[] = [TERMS, PRIVACY, REFUNDS, CONTACT];
