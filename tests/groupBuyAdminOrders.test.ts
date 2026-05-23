import { describe, expect, it } from 'vitest';

import { buildGroupedAdminOrderCards } from '@/lib/groupBuyAdminOrders';

describe('group buy admin order grouping', () => {
  it('collapses a master order and child orders into one group card', () => {
    const cards = buildGroupedAdminOrderCards([
      {
        id: 'master',
        created_at: '2026-05-20T10:00:00.000Z',
        updated_at: '2026-05-20T10:00:00.000Z',
        group_buy_id: 'group-1',
        is_group_buy_master: true,
        order_number: 'AJYN-MASTER',
        parent_order_id: null,
        status: 'confirmed',
        total_amount: 30,
        user_id: 'host-1',
      },
      {
        id: 'child-1',
        created_at: '2026-05-20T10:01:00.000Z',
        updated_at: '2026-05-20T10:01:00.000Z',
        group_buy_id: 'group-1',
        is_group_buy_master: false,
        order_number: 'AJYN-CHILD-1',
        parent_order_id: 'master',
        status: 'confirmed',
        total_amount: 10,
        user_id: 'user-1',
      },
      {
        id: 'child-2',
        created_at: '2026-05-20T10:02:00.000Z',
        updated_at: '2026-05-20T10:02:00.000Z',
        group_buy_id: 'group-1',
        is_group_buy_master: false,
        order_number: 'AJYN-CHILD-2',
        parent_order_id: 'master',
        status: 'confirmed',
        total_amount: 20,
        user_id: 'user-2',
      },
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.kind).toBe('group');
    if (cards[0]?.kind !== 'group') {
      throw new Error('Expected a grouped card');
    }

    expect(cards[0].cluster.displayOrderNumber).toBe('AJYN-MASTER');
    expect(cards[0].cluster.participantCount).toBe(2);
    expect(cards[0].cluster.totalAmount).toBe(30);
  });

  it('keeps standard orders as standalone cards', () => {
    const cards = buildGroupedAdminOrderCards([
      {
        id: 'standard-1',
        created_at: '2026-05-20T10:00:00.000Z',
        updated_at: '2026-05-20T10:00:00.000Z',
        group_buy_id: null,
        is_group_buy_master: false,
        order_number: 'AJYN-STD-1',
        parent_order_id: null,
        status: 'processing',
        total_amount: 15,
        user_id: 'user-3',
      },
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.kind).toBe('standard');
  });
});
