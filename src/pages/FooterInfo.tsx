import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Briefcase, Building2, HeartHandshake, Mail, RotateCcw, ShieldCheck, Scale } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BRAND_NAME, BRAND_SUPPORT_NAME } from '@/lib/brand';

type FooterPage = {
  eyebrow: string;
  title: string;
  intro: string;
  icon: typeof Building2;
  sections: Array<{
    title: string;
    body: string;
  }>;
  cta?: {
    label: string;
    href: string;
  };
};

const footerPages: Record<string, FooterPage> = {
  '/about': {
    eyebrow: 'About AJYN',
    title: 'Cross-border shopping, made clearer.',
    intro:
      `${BRAND_NAME} helps shoppers discover products, choose delivery with context, join group buys, and track orders without getting lost in the process.`,
    icon: Building2,
    sections: [
      {
        title: 'What we do',
        body:
          'We bring catalog shopping, group-buy savings, delivery estimates, customs guidance, and order tracking into one customer flow.',
      },
      {
        title: 'How we work',
        body:
          'Every order is built around clarity: product pricing, shipping choice, payment confirmation, tracking updates, and post-purchase support.',
      },
      {
        title: 'Who it is for',
        body:
          'AJYN is for shoppers who want access to global products with local context, predictable checkout, and a simpler way to repeat orders.',
      },
    ],
    cta: { label: 'Browse products', href: '/products' },
  },
  '/contact': {
    eyebrow: 'Contact',
    title: 'Need help with an order or product?',
    intro:
      `${BRAND_SUPPORT_NAME} is here for order questions, delivery follow-ups, payment issues, refunds, and product guidance.`,
    icon: Mail,
    sections: [
      {
        title: 'Order support',
        body:
          'Use your account support tab or order tracking page when your question relates to a specific order, payment, refund, or delivery update.',
      },
      {
        title: 'Product questions',
        body:
          'For product availability, variants, sizing, or group-buy questions, start from the product page so the team can see the item context.',
      },
      {
        title: 'General help',
        body:
          'The help center keeps common answers in one place, including shipping windows, tracking, customs estimates, returns, and group buys.',
      },
    ],
    cta: { label: 'Open help center', href: '/help' },
  },
  '/careers': {
    eyebrow: 'Careers',
    title: 'Build practical commerce for real shoppers.',
    intro:
      'We are shaping an ecommerce experience where operations, design, support, and product all work together to remove friction.',
    icon: Briefcase,
    sections: [
      {
        title: 'What we value',
        body:
          'Clear ownership, reliable follow-through, thoughtful customer support, and product decisions that make shopping easier, not louder.',
      },
      {
        title: 'How to reach us',
        body:
          'Current openings will be shared here as the team grows. For now, use the contact page for partnership or team enquiries.',
      },
    ],
    cta: { label: 'Contact us', href: '/contact' },
  },
  '/privacy-policy': {
    eyebrow: 'Privacy Policy',
    title: 'Your data should support your order, not surprise you.',
    intro:
      'This page explains the customer data AJYN may use to operate accounts, payments, delivery, support, loyalty, and shopping features.',
    icon: ShieldCheck,
    sections: [
      {
        title: 'Information we use',
        body:
          'We may use account details, saved addresses, order activity, payment references, support messages, wishlist activity, and delivery preferences to run the service.',
      },
      {
        title: 'Why we use it',
        body:
          'Data is used to authenticate users, process orders, verify payments, track delivery, prevent abuse, improve support, and personalize useful shopping features.',
      },
      {
        title: 'Customer control',
        body:
          'Customers can update profile details, manage saved addresses, review orders, and contact support about account or privacy questions.',
      },
    ],
    cta: { label: 'Manage account', href: '/profile' },
  },
  '/terms-of-service': {
    eyebrow: 'Terms of Service',
    title: 'Clear rules for shopping with AJYN.',
    intro:
      'These terms summarize how customers should use AJYN, how orders are handled, and what responsibilities apply during checkout and delivery.',
    icon: Scale,
    sections: [
      {
        title: 'Using the platform',
        body:
          'Customers should provide accurate account, delivery, and payment information and should not misuse checkout, referrals, support, or group-buy features.',
      },
      {
        title: 'Orders and payment',
        body:
          'Orders move forward after payment is confirmed. Group buys depend on the offer rules, participant limits, and payment confirmation for each participant.',
      },
      {
        title: 'Changes and availability',
        body:
          'Products, delivery windows, prices, promotions, and service features may change as inventory, shipping routes, and operational conditions change.',
      },
    ],
    cta: { label: 'Start shopping', href: '/products' },
  },
  '/returns-policy': {
    eyebrow: 'Returns Policy',
    title: 'Returns and refunds with context.',
    intro:
      'Returns and refunds depend on payment status, delivery state, product condition, and the support window available for the order.',
    icon: RotateCcw,
    sections: [
      {
        title: 'Refund requests',
        body:
          'Eligible orders show refund actions in order history. If an action is disabled, the order card explains why the request is not currently available.',
      },
      {
        title: 'Delivery confirmation',
        body:
          'After delivery, customers can confirm receipt, review the item, or contact support if something is wrong with the order.',
      },
      {
        title: 'Support review',
        body:
          'Some cases require support review, especially damaged items, incomplete deliveries, payment issues, or group-buy fulfilment questions.',
      },
    ],
    cta: { label: 'View my orders', href: '/my-orders' },
  },
};

export default function FooterInfo() {
  const location = useLocation();
  const page = footerPages[location.pathname] || footerPages['/about'];
  const Icon = page.icon;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-8 pb-12 sm:px-6 md:py-12">
        <div className="mx-auto max-w-4xl">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>

          <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-8 md:p-10">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-7 w-7" />
            </div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-primary">{page.eyebrow}</p>
            <h1 className="max-w-3xl font-serif text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl">
              {page.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              {page.intro}
            </p>
            {page.cta ? (
              <Button asChild className="mt-6 rounded-xl">
                <Link to={page.cta.href}>{page.cta.label}</Link>
              </Button>
            ) : null}
          </section>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {page.sections.map((section) => (
              <Card key={section.title} className="rounded-3xl border-border/70 bg-card/80 shadow-sm">
                <CardContent className="p-5 sm:p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                  <h2 className="mb-2 text-lg font-semibold text-foreground">{section.title}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">{section.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
