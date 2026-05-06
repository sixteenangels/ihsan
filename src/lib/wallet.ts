import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type WalletTransactionInsert = Database['public']['Tables']['wallet_transactions']['Insert'];
type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

interface CreditWalletInput {
  userId: string;
  amount: number;
  description: string;
  createdBy?: string | null;
  orderId?: string | null;
  referenceKey?: string | null;
  notificationTitle?: string;
  notificationMessage?: string;
}

export async function creditWalletByAdmin(input: CreditWalletInput) {
  if (input.amount <= 0) {
    throw new Error('Wallet credit amount must be greater than zero.');
  }

  if (input.referenceKey) {
    const { data: existingTransaction, error: existingError } = await supabase
      .from('wallet_transactions')
      .select('id')
      .eq('reference_key', input.referenceKey)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingTransaction) {
      return existingTransaction;
    }
  }

  const transaction: WalletTransactionInsert = {
    user_id: input.userId,
    amount: input.amount,
    type: 'credit',
    description: input.description,
    order_id: input.orderId || null,
    created_by: input.createdBy || null,
    reference_key: input.referenceKey || null,
  };

  const { data: createdTransaction, error: transactionError } = await supabase
    .from('wallet_transactions')
    .insert(transaction)
    .select('id')
    .single();

  if (transactionError) {
    throw transactionError;
  }

  const notification: NotificationInsert = {
    user_id: input.userId,
    title: input.notificationTitle || 'Wallet Credited',
    message:
      input.notificationMessage ||
      `₵${input.amount.toFixed(2)} has been added to your wallet. ${input.description}`,
    type: 'wallet',
  };

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert(notification);

  if (notificationError) {
    throw notificationError;
  }

  return createdTransaction;
}
