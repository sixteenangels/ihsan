import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Building2, HeartHandshake, Mail, RotateCcw, ShieldCheck, Scale } from 'lucide-react';
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
    title: 'Shopping the world, simplified.',
    intro:
      `${BRAND_NAME} is a global shopping platform built to make cross-border shopping more accessible, transparent, and affordable.`,
    icon: Building2,
    sections: [
      {
        title: 'Global shopping, clearer pricing',
        body:
          'We connect shoppers to products from around the world while providing clear pricing, flexible delivery options, and opportunities to save through Group Buys.',
      },
      {
        title: 'International and local options',
        body:
          'Alongside internationally sourced products, AJYN also offers locally available products for customers who prefer faster delivery.',
      },
      {
        title: 'From discovery to delivery',
        body:
          'Our goal is simple: to remove the complexity often associated with international shopping and create a smoother experience from discovery to delivery.',
      },
      {
        title: 'Shop with confidence',
        body:
          "Whether you're searching for fashion, beauty products, electronics, home essentials, or unique global finds, AJYN is designed to help you shop with greater confidence and convenience.",
      },
      {
        title: 'Support every step of the way',
        body:
          'Customer experience remains at the heart of everything we do. Through our in-app support team, we strive to provide timely assistance and a reliable shopping experience every step of the way.',
      },
      {
        title: 'AJYN',
        body:
          'Shopping the world, simplified.',
      },
    ],
    cta: { label: 'Browse products', href: '/products' },
  },
  '/contact': {
    eyebrow: 'Contact',
    title: 'Need help with an order or product?',
    intro:
      `The ${BRAND_SUPPORT_NAME} team is here to assist with order questions, delivery updates, payment issues, refunds, product inquiries, and Group Buy support.`,
    icon: Mail,
    sections: [
      {
        title: 'Order-related questions',
        body:
          'For order-related questions, including payments, refunds, delivery updates, or tracking information, visit your order tracking page or the Support section within your account.',
      },
      {
        title: 'Product-related questions',
        body:
          'For product-related questions such as availability, variants, sizing, or Group Buy details, start from the product page so our team can provide assistance with the correct item context.',
      },
      {
        title: 'Help Center',
        body:
          'The Help Center provides answers to common questions about shipping, delivery estimates, customs guidance, returns, refunds, tracking, and Group Buys.',
      },
      {
        title: 'AJYN',
        body:
          'Shopping the world, simplified.',
      },
    ],
    cta: { label: 'Open help center', href: '/help' },
  },
  '/careers': {
    eyebrow: 'Careers',
    title: 'Need help with an order or product?',
    intro:
      `The ${BRAND_SUPPORT_NAME} team is here to assist with order questions, delivery updates, payment issues, refunds, product inquiries, and Group Buy support.`,
    icon: Mail,
    sections: [
      {
        title: 'Order-related questions',
        body:
          'For order-related questions, including payments, refunds, delivery updates, or tracking information, visit your order tracking page or the Support section within your account.',
      },
      {
        title: 'Product-related questions',
        body:
          'For product-related questions such as availability, variants, sizing, or Group Buy details, start from the product page so our team can provide assistance with the correct item context.',
      },
      {
        title: 'Help Center',
        body:
          'The Help Center provides answers to common questions about shipping, delivery estimates, customs guidance, returns, refunds, tracking, and Group Buys.',
      },
      {
        title: 'AJYN',
        body:
          'Shopping the world, simplified.',
      },
    ],
    cta: { label: 'Open help center', href: '/help' },
  },
  '/privacy-policy': {
    eyebrow: 'Privacy Policy',
    title: 'Your data helps us process and deliver your orders smoothly.',
    intro:
      'This page explains how AJYN collects, uses, and protects customer information when you use our platform.',
    icon: ShieldCheck,
    sections: [
      {
        title: 'Information we collect',
        body:
          'We collect information you provide when creating an account, placing an order, contacting support, or using AJYN features. This may include account details, saved addresses, order history, payment references, support messages, wishlist activity, and delivery preferences. We may also collect limited device and usage information to help improve app performance and user experience.',
      },
      {
        title: 'Why we use your information',
        body:
          'We use your information to operate the AJYN platform, including processing and fulfilling orders, managing customer accounts, handling payments and refunds, tracking deliveries, providing customer support, preventing fraud or misuse, and improving platform features and shopping experience.',
      },
      {
        title: 'Sharing of information',
        body:
          'We do not sell your personal data. We may share necessary information with trusted third parties such as payment processors, logistics providers, and delivery partners strictly for the purpose of completing orders and operating the service.',
      },
      {
        title: 'Customer control',
        body:
          'You can update your account information, manage saved addresses, view order history, and contact support regarding any privacy-related concerns.',
      },
      {
        title: 'Data security',
        body:
          'We take appropriate measures to protect your information against unauthorized access, loss, or misuse.',
      },
      {
        title: 'Data retention',
        body:
          'We retain customer information only for as long as necessary to provide services and comply with legal obligations.',
      },
      {
        title: 'Contact us',
        body:
          'For privacy questions or data requests, please contact support through the AJYN app.',
      },
      {
        title: 'AJYN',
        body:
          'Shopping the world, simplified.',
      },
    ],
    cta: { label: 'Manage account', href: '/profile' },
  },
  '/terms-of-service': {
    eyebrow: 'Terms of Service',
    title: 'TERMS OF SERVICE',
    intro:
      'Last updated: 30th May 2026. These Terms of Service govern your use of AJYN. By accessing or using the platform, you agree to these terms.',
    icon: Scale,
    sections: [
      {
        title: 'PLATFORM OVERVIEW',
        body:
          'AJYN is a shopping platform that provides access to locally available and internationally sourced products. The platform supports standard purchases and Group Buy-based discounted purchases. Users agree to use AJYN responsibly and provide accurate account, payment, and delivery information at all times. AJYN reserves the right to suspend or restrict access where misuse, fraud, or abuse of the platform is detected.',
      },
      {
        title: 'ORDERS AND PAYMENTS',
        body:
          'All orders are confirmed only after successful payment. Product availability, pricing, shipping options, and delivery estimates are subject to change based on stock levels, supplier conditions, logistics availability, and external factors. AJYN is not responsible for pricing or availability changes that occur before order confirmation.',
      },
      {
        title: 'GROUP BUYS',
        body:
          'Group Buys allow customers to purchase collectively in order to unlock better pricing. Customers may cancel participation within 1 hour of joining a Group Buy. After this 1-hour period, participation becomes locked and cannot be cancelled or refunded, as orders are immediately processed for supplier confirmation, pricing, and logistics preparation. If a Group Buy does not reach its required participant threshold within the specified timeframe, AJYN may cancel the order and issue a refund.',
      },
      {
        title: 'SHIPPING AND DELIVERY',
        body:
          "AJYN automatically assigns a cost-effective and reliable shipping method for each order based on product type, destination, and logistics conditions. Customers may request alternative shipping methods via support, subject to availability. Any additional shipping costs will be borne by the customer. Delivery timelines are estimates only and are not guaranteed. Delays may occur due to customs processing, third-party logistics providers, or other external factors beyond AJYN's control. An order is considered delivered once the logistics provider marks it as delivered. AJYN is not responsible for packages confirmed as delivered by the shipping provider.",
      },
      {
        title: 'CUSTOMS AND IMPORT DUTIES',
        body:
          'Customers are responsible for any customs duties, import taxes, or government charges required by their country. These fees are not included in product prices unless explicitly stated.',
      },
      {
        title: 'WRONG DELIVERY INFORMATION',
        body:
          'Customers are responsible for providing accurate delivery details. If incorrect information is provided, customers must contact AJYN support as soon as possible. Where possible, AJYN may assist in updating delivery details before dispatch. Once shipped, changes may not be possible. If an order is returned due to incorrect address information, additional reshipping costs may apply.',
      },
      {
        title: 'FRAGILE ITEMS AND PACKAGING',
        body:
          'Certain products may be classified as fragile and may offer multiple packaging options. Standard packaging is the default option. Reinforced packaging is available at an additional cost and is recommended for fragile items to reduce the risk of damage during transit. AJYN is not responsible for damage to fragile items where the customer selects standard packaging instead of reinforced packaging.',
      },
      {
        title: 'RETURNS AND REFUNDS',
        body:
          'Customers may request a refund within 48 hours of placing an order, provided the order has not yet been shipped or handed over to a logistics provider. Once an order has been shipped, it cannot be cancelled or refunded except in cases of verified issues upon delivery. Customers must report any issue within 48 hours of receiving the item. Eligible return cases include wrong item delivered, damaged item upon arrival, and defective product upon receipt. Returns will not be accepted if the item has been used or altered, the item is not in original condition or packaging, damage occurred after delivery due to customer handling or misuse, or the request is made after the 48-hour reporting window. Only verified issues present at the time of delivery qualify for returns or refunds. Refunds may be issued where an order cannot be fulfilled, a Group Buy does not succeed, or a return request is approved under eligible conditions. Refunds are processed to the original payment method where possible. Processing times may vary depending on banks or payment providers. Transaction fees, processing charges, and transfer fees are non-refundable as they are charged by third-party payment providers.',
      },
      {
        title: 'LIMITATION OF LIABILITY',
        body:
          "AJYN is not liable for indirect, incidental, or consequential losses arising from use of the platform. AJYN is not responsible for delays, losses, or damages caused by third-party logistics providers, customs authorities, payment processors, or any external systems beyond its control. AJYN's responsibility is strictly limited to the value of the purchased product under eligible refund conditions.",
      },
      {
        title: 'DELIVERY CONFIRMATION',
        body:
          'An order is considered fully completed once marked as delivered by the shipping provider. AJYN is not responsible for claims of non-receipt where delivery has been confirmed by the logistics provider.',
      },
      {
        title: 'ACCOUNT RESPONSIBILITY',
        body:
          'Users are responsible for maintaining the security of their accounts and for all activities conducted under their account. Users must ensure all information provided is accurate and up to date.',
      },
      {
        title: 'CHANGES TO TERMS',
        body:
          'AJYN may update these Terms at any time. Continued use of the platform after updates constitutes acceptance of the revised Terms.',
      },
      {
        title: 'CONTACT',
        body:
          'For support regarding orders, delivery issues, or refunds, please contact AJYN support through the app.',
      },
      {
        title: 'AJYN',
        body:
          'Shopping the world, simplified.',
      },
    ],
    cta: { label: 'Start shopping', href: '/products' },
  },
  '/returns-policy': {
    eyebrow: 'Shipping and Returns Policy',
    title: 'SHIPPING & RETURNS POLICY',
    intro:
      'Last updated: 30th May 2026. This policy explains how shipping, delivery, returns, and refunds are handled on AJYN.',
    icon: RotateCcw,
    sections: [
      {
        title: 'SHIPPING OVERVIEW',
        body:
          "AJYN offers both locally available products and internationally sourced products. Each order is matched with the most cost-effective and reliable shipping method based on destination, product type, and logistics conditions. Customers may request alternative shipping methods through customer support, subject to availability and approval. Any additional costs resulting from upgraded or alternative shipping methods will be borne by the customer. Estimated delivery times shown at checkout are for guidance only and may vary due to customs processing, carrier delays, or other external logistics factors beyond AJYN's control.",
      },
      {
        title: 'ORDER PROCESSING',
        body:
          'Orders are processed once payment is successfully confirmed. AJYN reserves the right to cancel and refund any order that cannot be fulfilled due to supplier limitations, inventory availability, or logistics constraints.',
      },
      {
        title: 'GROUP BUY POLICY',
        body:
          'Group Buy participation is time-sensitive and subject to strict confirmation rules. Customers may cancel participation within 1 hour of joining a Group Buy. After this period, participation becomes locked and cannot be cancelled or refunded, as orders are immediately processed for supplier confirmation, pricing, and logistics preparation. If a Group Buy does not reach its required participant threshold within the specified timeframe, the order may be cancelled and refunded.',
      },
      {
        title: 'SHIPPING AND DELIVERY',
        body:
          'Delivery timelines are estimates only and not guaranteed. AJYN is not responsible for delays caused by customs authorities, third-party logistics providers, or other external shipping disruptions. An order is considered successfully delivered once marked as delivered by the shipping provider. AJYN is not responsible for packages confirmed as delivered by the courier.',
      },
      {
        title: 'WRONG DELIVERY INFORMATION',
        body:
          'Customers are responsible for providing accurate delivery details at checkout. If incorrect delivery information is provided, customers should contact AJYN support as soon as possible. Where an order has not yet been shipped, AJYN may assist in updating delivery details. Once shipped, changes may not be possible. If a package is returned due to incorrect address information, additional reshipping costs may apply.',
      },
      {
        title: 'FRAGILE ITEMS & PACKAGING',
        body:
          'Certain products are classified as fragile and may have multiple packaging options. Standard packaging is the default option. Reinforced packaging is available at an additional cost and is recommended for fragile items to reduce the risk of damage during transit. AJYN is not liable for damage to fragile items where the customer selects standard packaging instead of reinforced packaging.',
      },
      {
        title: 'RETURNS POLICY',
        body:
          'Customers must report any issue with a delivered order within 48 hours of receipt. Eligible return cases include wrong item delivered, damaged item upon arrival, and defective product upon receipt. Returns will not be accepted if the item has been used or altered, the item is not in original condition or packaging, damage occurred after delivery due to customer handling or misuse, or the return request is made after the 48-hour reporting window. Only verified issues present at the time of delivery qualify for returns or refunds.',
      },
      {
        title: 'REFUNDS',
        body:
          "Refunds may be issued where an order cannot be fulfilled, a Group Buy does not succeed, or a return request is approved under eligible conditions. Refunds are processed to the original payment method where possible. Processing times may vary depending on banks or payment providers. Transaction fees, payment processing charges, and transfer fees are non-refundable as they are charged by third-party payment providers and are outside AJYN's control.",
      },
      {
        title: 'CUSTOMS & IMPORT DUTIES',
        body:
          'Customers are responsible for any customs duties, import taxes, or government charges required in their country. These fees are not included in product prices unless explicitly stated.',
      },
      {
        title: 'LIMITATION OF LIABILITY',
        body:
          "AJYN is not responsible for delays, losses, or damages caused by third-party logistics providers, customs authorities, payment processors, or other external systems beyond its control. AJYN is not liable for indirect, incidental, or consequential losses. AJYN's responsibility is limited to the value of the purchased product under eligible refund conditions.",
      },
      {
        title: 'CONTACT',
        body:
          'For support regarding orders, delivery issues, or refunds, please contact AJYN support through the app.',
      },
      {
        title: 'AJYN',
        body:
          'Shopping the world, simplified.',
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
