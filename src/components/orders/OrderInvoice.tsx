import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { BRAND_NAME } from '@/lib/brand';

interface InvoiceItem {
  product_name: string;
  variant_details: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface InvoiceOrder {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  subtotal: number;
  shipping_price: number;
  total_amount: number;
  order_items: InvoiceItem[];
  shipping_address?: {
    full_name: string;
    phone?: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
  } | null;
}

interface OrderInvoiceProps {
  order: InvoiceOrder;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function OrderInvoice({ order }: OrderInvoiceProps) {
  const { formatPrice } = useCurrency();

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;

    const addr = order.shipping_address;
    const date = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const formattedSubtotal = formatPrice(order.subtotal);
    const formattedShipping = formatPrice(order.shipping_price || 0);
    const formattedTotal = formatPrice(order.total_amount);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${escapeHtml(order.order_number)}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; }
          .logo { display: inline-flex; align-items: center; justify-content: center; min-width: 128px; background: #ffffff; padding: 10px 16px; color: #202124; line-height: 1; }
          .logo svg { display: block; width: 96px; height: 70px; }
          .invoice-info { text-align: right; }
          .invoice-info h2 { margin: 0; font-size: 24px; color: #666; }
          .addresses { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .address-block h4 { margin: 0 0 8px; color: #666; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
          .address-block p { margin: 2px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f5f5f5; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ddd; }
          td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
          .totals { float: right; width: 280px; }
          .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
          .totals .total { font-size: 18px; font-weight: bold; border-top: 2px solid #1a1a1a; padding-top: 12px; margin-top: 8px; }
          .footer { margin-top: 60px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo" aria-label="${escapeHtml(BRAND_NAME)}">
            <svg role="img" aria-label="${escapeHtml(BRAND_NAME)}" viewBox="40 96 444 320" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M58 158c48 54 133 54 219 102-70-21-154-7-209-74-6-8-9-17-10-28Z" />
              <path fill="currentColor" d="M72 231c51 57 146 37 214 91-69-18-157 12-210-61-7-10-8-20-4-30Z" />
              <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M220 392 328 118h27l111 274h-49L340 171 266 392h-46ZM299 321h95l-52-126-43 126Z" />
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="17" d="M264 262c47 17 90 45 139 70" />
              <circle cx="430" cy="130" r="22" fill="#c96500" />
            </svg>
          </div>
          <div class="invoice-info">
            <h2>INVOICE</h2>
            <p><strong>${escapeHtml(order.order_number)}</strong></p>
            <p>${escapeHtml(date)}</p>
          </div>
        </div>
        ${addr ? `
        <div class="addresses">
          <div class="address-block">
            <h4>Ship To</h4>
            <p><strong>${escapeHtml(addr.full_name)}</strong></p>
            <p>${escapeHtml(addr.address_line1)}</p>
            ${addr.address_line2 ? `<p>${escapeHtml(addr.address_line2)}</p>` : ''}
            <p>${escapeHtml(`${addr.city}${addr.state ? `, ${addr.state}` : ''}${addr.postal_code ? ` ${addr.postal_code}` : ''}`)}</p>
            <p>${escapeHtml(addr.country)}</p>
            ${addr.phone ? `<p>Phone: ${escapeHtml(addr.phone)}</p>` : ''}
          </div>
        </div>
        ` : ''}
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Details</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Unit Price</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.order_items.map(item => `
              <tr>
                <td>${escapeHtml(item.product_name)}</td>
                <td>${escapeHtml(item.variant_details || '-')}</td>
                <td style="text-align:center">${escapeHtml(item.quantity)}</td>
                <td style="text-align:right">${escapeHtml(formatPrice(item.unit_price))}</td>
                <td style="text-align:right">${escapeHtml(formatPrice(item.total_price))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${escapeHtml(formattedSubtotal)}</span></div>
          <div class="row"><span>Shipping</span><span>${escapeHtml(formattedShipping)}</span></div>
          <div class="row total"><span>Total</span><span>${escapeHtml(formattedTotal)}</span></div>
        </div>
        <div style="clear:both"></div>
        <div class="footer">
          <p>Thank you for shopping with ${escapeHtml(BRAND_NAME)}!</p>
          <p>This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <FileText className="h-4 w-4 mr-1" />
      Invoice
    </Button>
  );
}
