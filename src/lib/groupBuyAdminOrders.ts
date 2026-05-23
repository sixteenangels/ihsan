interface GroupableOrder {
  id: string;
  created_at: string;
  updated_at: string;
  group_buy_id: string | null;
  is_group_buy_master: boolean | null;
  order_number: string;
  parent_order_id: string | null;
  status: string | null;
  total_amount: number;
  user_id: string;
}

export interface GroupOrderCluster<T extends GroupableOrder> {
  allOrders: T[];
  childOrders: T[];
  createdAt: string;
  displayOrderNumber: string;
  groupBuyId: string;
  masterOrder: T | null;
  participantCount: number;
  primaryOrder: T;
  status: string | null;
  totalAmount: number;
  updatedAt: string;
}

export type GroupedAdminOrderCard<T extends GroupableOrder> =
  | {
      id: string;
      kind: 'group';
      sortDate: string;
      cluster: GroupOrderCluster<T>;
    }
  | {
      id: string;
      kind: 'standard';
      sortDate: string;
      order: T;
    };

export function buildGroupedAdminOrderCards<T extends GroupableOrder>(
  orders: T[],
): GroupedAdminOrderCard<T>[] {
  const grouped = new Map<string, T[]>();
  const cards: GroupedAdminOrderCard<T>[] = [];

  orders.forEach((order) => {
    if (!order.group_buy_id) {
      cards.push({
        id: order.id,
        kind: 'standard',
        order,
        sortDate: order.created_at,
      });
      return;
    }

    const existing = grouped.get(order.group_buy_id) || [];
    existing.push(order);
    grouped.set(order.group_buy_id, existing);
  });

  grouped.forEach((groupOrders, groupBuyId) => {
    const sortedOrders = [...groupOrders].sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
    const masterOrder = sortedOrders.find((order) => order.is_group_buy_master) || null;
    const childOrders = sortedOrders.filter((order) => !order.is_group_buy_master);
    const primaryOrder = masterOrder || childOrders[0] || sortedOrders[0];

    if (!primaryOrder) {
      return;
    }

    const totalAmount = masterOrder
      ? Number(masterOrder.total_amount)
      : childOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);

    cards.push({
      id: `group:${groupBuyId}`,
      kind: 'group',
      sortDate: masterOrder?.created_at || primaryOrder.created_at,
      cluster: {
        allOrders: sortedOrders,
        childOrders,
        createdAt: masterOrder?.created_at || primaryOrder.created_at,
        displayOrderNumber:
          masterOrder?.order_number || `GROUP-${groupBuyId.slice(0, 8).toUpperCase()}`,
        groupBuyId,
        masterOrder,
        participantCount: childOrders.length > 0 ? childOrders.length : sortedOrders.length,
        primaryOrder,
        status: masterOrder?.status || primaryOrder.status,
        totalAmount,
        updatedAt: masterOrder?.updated_at || primaryOrder.updated_at,
      },
    });
  });

  return cards.sort(
    (left, right) =>
      new Date(right.sortDate).getTime() - new Date(left.sortDate).getTime(),
  );
}
