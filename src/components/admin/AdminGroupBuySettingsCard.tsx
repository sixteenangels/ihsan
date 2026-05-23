import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

import { useGroupBuySettings } from '@/hooks/useGroupBuySettings';
import {
  buildGroupBuySettingsSnapshot,
  DEFAULT_GROUP_BUY_SETTINGS,
  formatGroupBuyDuration,
  GROUP_BUY_DISCOUNT_MODES,
  GROUP_BUY_DURATION_UNITS,
  GROUP_BUY_REFUND_TRIGGERS,
  GROUP_BUY_SETTINGS_STORE_KEY,
  GROUP_BUY_SHIPPING_METHODS,
  type GroupBuyDiscountMode,
  type GroupBuyMilestoneDiscount,
  type GroupBuyRefundTrigger,
  type GroupBuySettings,
  type GroupBuyShippingMethod,
} from '@/lib/groupBuyConfig';
import { upsertStoreSetting } from '@/lib/storeSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const SHIPPING_METHOD_LABELS: Record<GroupBuyShippingMethod, string> = {
  air_shipping: 'Air Shipping',
  sea_shipping: 'Sea Shipping',
  courier_delivery: 'Courier (Local) Delivery',
};

const REFUND_TRIGGER_LABELS: Record<GroupBuyRefundTrigger, string> = {
  group_buy_failed: 'Refund if group buy fails',
  supplier_unavailable: 'Refund if supplier unavailable',
  admin_cancelled: 'Refund if admin cancels',
};

function toTextList(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function moveItem<T>(items: T[], fromIndex: number, direction: -1 | 1): T[] {
  const nextIndex = fromIndex + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const clone = [...items];
  const [movedItem] = clone.splice(fromIndex, 1);
  clone.splice(nextIndex, 0, movedItem);
  return clone;
}

export function AdminGroupBuySettingsCard() {
  const queryClient = useQueryClient();
  const { settings, isLoading } = useGroupBuySettings();
  const [draft, setDraft] = useState<GroupBuySettings>(DEFAULT_GROUP_BUY_SETTINGS);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (nextSettings: GroupBuySettings) => {
      await upsertStoreSetting(
        GROUP_BUY_SETTINGS_STORE_KEY,
        buildGroupBuySettingsSnapshot(nextSettings),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast.success('Group-buy defaults saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save group-buy defaults');
    },
  });

  const countdownPreview = useMemo(
    () => formatGroupBuyDuration(draft.countdownDurationValue, draft.countdownDurationUnit),
    [draft.countdownDurationUnit, draft.countdownDurationValue],
  );

  const unpaidReservationPreview = useMemo(
    () =>
      formatGroupBuyDuration(
        draft.autoCancelUnpaidReservationsValue,
        draft.autoCancelUnpaidReservationsUnit,
      ),
    [draft.autoCancelUnpaidReservationsUnit, draft.autoCancelUnpaidReservationsValue],
  );

  const refundWindowPreview = useMemo(
    () =>
      formatGroupBuyDuration(
        draft.refundEligibilityWindowValue,
        draft.refundEligibilityWindowUnit,
      ),
    [draft.refundEligibilityWindowUnit, draft.refundEligibilityWindowValue],
  );

  const estimatedTimelinePreview = useMemo(
    () =>
      formatGroupBuyDuration(
        draft.estimatedProcessingTimelineValue,
        draft.estimatedProcessingTimelineUnit,
      ),
    [draft.estimatedProcessingTimelineUnit, draft.estimatedProcessingTimelineValue],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle>Default Group-Buy Controls</CardTitle>
          <CardDescription>
            New group buys inherit these defaults automatically. Live deals can still be overridden one by one below.
          </CardDescription>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Default timer: {countdownPreview}</span>
            <span>Unpaid reservation window: {unpaidReservationPreview}</span>
            <span>Refund window: {refundWindowPreview}</span>
            <span>Processing timeline: {estimatedTimelinePreview}</span>
          </div>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => saveMutation.mutate(draft)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Defaults
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Participation & Timer</CardTitle>
              <CardDescription>
                Controls for target size, visibility, countdown window, and automatic close/confirm behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum Participants Required</Label>
                  <Input
                    type="number"
                    min="2"
                    value={draft.minParticipantsRequired}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        minParticipantsRequired: Math.max(2, Number(event.target.value) || 2),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum Participants Allowed</Label>
                  <Input
                    type="number"
                    min={draft.minParticipantsRequired}
                    value={draft.maxParticipantsAllowed}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        maxParticipantsAllowed: Math.max(
                          current.minParticipantsRequired,
                          Number(event.target.value) || current.minParticipantsRequired,
                        ),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="space-y-2">
                  <Label>Group-Buy Countdown Duration</Label>
                  <Input
                    type="number"
                    min="1"
                    value={draft.countdownDurationValue}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        countdownDurationValue: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Unit</Label>
                  <Select
                    value={draft.countdownDurationUnit}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        countdownDurationUnit: value as GroupBuySettings['countdownDurationUnit'],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_BUY_DURATION_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Auto-Close After Full Participation</Label>
                    <p className="text-xs text-muted-foreground">
                      Close participation automatically when the max participant cap is reached.
                    </p>
                  </div>
                  <Switch
                    checked={draft.autoCloseWhenFull}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, autoCloseWhenFull: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Auto-Confirm When Target Is Reached</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically mark the group buy ready for processing once the minimum target is met.
                    </p>
                  </div>
                  <Switch
                    checked={draft.autoConfirmWhenTargetReached}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, autoConfirmWhenTargetReached: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Manual Confirmation Option</Label>
                    <p className="text-xs text-muted-foreground">
                      Keep admin review in the loop before a filled group buy moves to processing.
                    </p>
                  </div>
                  <Switch
                    checked={draft.manualConfirmationRequired}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, manualConfirmationRequired: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Visible By Default</Label>
                    <p className="text-xs text-muted-foreground">
                      Newly created group buys will be visible in product pages and group-buy listings.
                    </p>
                  </div>
                  <Switch
                    checked={draft.visibleByDefault}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, visibleByDefault: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Featured By Default</Label>
                    <p className="text-xs text-muted-foreground">
                      Promote new group buys by default so they float to the top of featured sections.
                    </p>
                  </div>
                  <Switch
                    checked={draft.featuredByDefault}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, featuredByDefault: checked }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Payment & Participation</CardTitle>
              <CardDescription>
                Controls for duplicate joins, unpaid reservation handling, and how aggressively seats are held.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                <div>
                  <Label>Allow Partial Fulfillment</Label>
                  <p className="text-xs text-muted-foreground">
                    Process the participants who are ready even when the whole campaign does not convert at once.
                  </p>
                </div>
                <Switch
                  checked={draft.allowPartialFulfillment}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, allowPartialFulfillment: checked }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="space-y-2">
                  <Label>Auto-Cancel Unpaid Reservations</Label>
                  <Input
                    type="number"
                    min="1"
                    value={draft.autoCancelUnpaidReservationsValue}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        autoCancelUnpaidReservationsValue: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Unit</Label>
                  <Select
                    value={draft.autoCancelUnpaidReservationsUnit}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        autoCancelUnpaidReservationsUnit: value as GroupBuySettings['autoCancelUnpaidReservationsUnit'],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_BUY_DURATION_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Participant Limit Per User</Label>
                <Input
                  type="number"
                  min="1"
                  value={draft.participantLimitPerUser}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      participantLimitPerUser: Math.max(1, Number(event.target.value) || 1),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This currently caps the total quantity a shopper can commit inside one group buy.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Allow Duplicate Participation</Label>
                    <p className="text-xs text-muted-foreground">
                      Let the same shopper add more quantity to the same live group buy after the first join.
                    </p>
                  </div>
                  <Switch
                    checked={draft.allowDuplicateParticipation}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, allowDuplicateParticipation: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Require Full Payment Before Joining</Label>
                    <p className="text-xs text-muted-foreground">
                      Prevent unpaid shoppers from occupying participant slots.
                    </p>
                  </div>
                  <Switch
                    checked={draft.requireFullPaymentBeforeJoining}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, requireFullPaymentBeforeJoining: checked }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Shipping Controls</CardTitle>
              <CardDescription>
                Restrict shipping choices, set a preferred route, and capture handling warnings for future fulfillment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Allowed Shipping Methods</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GROUP_BUY_SHIPPING_METHODS.map((method) => {
                    const checked = draft.allowedShippingMethods.includes(method);
                    return (
                      <label
                        key={method}
                        className="flex items-center gap-3 rounded-xl border border-border/70 p-3 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) =>
                            setDraft((current) => {
                              const nextMethods = nextChecked
                                ? [...current.allowedShippingMethods, method]
                                : current.allowedShippingMethods.filter((entry) => entry !== method);

                              const dedupedMethods = Array.from(new Set(nextMethods));
                              return {
                                ...current,
                                allowedShippingMethods:
                                  dedupedMethods.length > 0 ? dedupedMethods : [method],
                                defaultShippingMethod:
                                  dedupedMethods.includes(current.defaultShippingMethod) || nextChecked
                                    ? current.defaultShippingMethod
                                    : method,
                              };
                            })
                          }
                        />
                        <span>{SHIPPING_METHOD_LABELS[method]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default Shipping Method</Label>
                <Select
                  value={draft.defaultShippingMethod}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      defaultShippingMethod: value as GroupBuyShippingMethod,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {draft.allowedShippingMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {SHIPPING_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                  <div>
                    <Label>Fragile Item</Label>
                    <p className="text-xs text-muted-foreground">
                      Mark new group buys as fragile by default.
                    </p>
                  </div>
                  <Switch
                    checked={draft.fragileItemByDefault}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, fragileItemByDefault: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                  <div>
                    <Label>Reinforced Packaging</Label>
                    <p className="text-xs text-muted-foreground">
                      Let shoppers request reinforced packaging when needed.
                    </p>
                  </div>
                  <Switch
                    checked={draft.reinforcedPackagingAvailable}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, reinforcedPackagingAvailable: checked }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Shipping Restriction Notes</Label>
                <Textarea
                  rows={4}
                  value={draft.shippingRestrictionNotes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      shippingRestrictionNotes: event.target.value,
                    }))
                  }
                  placeholder="Sea shipping not recommended for electronics."
                />
              </div>

              <div className="space-y-2">
                <Label>Shipping Fee Override</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.shippingFeeOverride ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      shippingFeeOverride:
                        event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                  placeholder="Leave blank to use normal shipping fee logic"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Pricing & Refund Rules</CardTitle>
              <CardDescription>
                Tune discount behavior, dynamic pricing milestones, and refund/cancellation handling from one place.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label>Group Discount Mode</Label>
                  <Select
                    value={draft.groupDiscountMode}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        groupDiscountMode: value as GroupBuyDiscountMode,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_BUY_DISCOUNT_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Group Discount Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.groupDiscountAmount}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        groupDiscountAmount: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                  <div>
                    <Label>Dynamic Pricing</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow prices to shift as participation climbs.
                    </p>
                  </div>
                  <Switch
                    checked={draft.dynamicPricing}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, dynamicPricing: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                  <div>
                    <Label>Admin Override Pricing</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow manual pricing overrides for special group-buy campaigns.
                    </p>
                  </div>
                  <Switch
                    checked={draft.adminOverridePricing}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, adminOverridePricing: checked }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Participant Milestone Discounts</Label>
                    <p className="text-xs text-muted-foreground">
                      Define extra discount unlocks that can be reused when building new deals.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        participantMilestoneDiscounts: [
                          ...current.participantMilestoneDiscounts,
                          {
                            id: `milestone-${Date.now()}`,
                            participants: current.minParticipantsRequired,
                            mode: 'percentage',
                            amount: 0,
                          },
                        ],
                      }))
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Milestone
                  </Button>
                </div>
                <div className="space-y-3">
                  {draft.participantMilestoneDiscounts.map((milestone, index) => (
                    <div key={milestone.id} className="rounded-xl border border-border/70 p-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_10rem_auto]">
                        <div className="space-y-2">
                          <Label>Participants</Label>
                          <Input
                            type="number"
                            min="1"
                            value={milestone.participants}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                participantMilestoneDiscounts: current.participantMilestoneDiscounts.map((entry) =>
                                  entry.id === milestone.id
                                    ? {
                                        ...entry,
                                        participants: Math.max(1, Number(event.target.value) || 1),
                                      }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Mode</Label>
                          <Select
                            value={milestone.mode}
                            onValueChange={(value) =>
                              setDraft((current) => ({
                                ...current,
                                participantMilestoneDiscounts: current.participantMilestoneDiscounts.map((entry) =>
                                  entry.id === milestone.id
                                    ? { ...entry, mode: value as GroupBuyDiscountMode }
                                    : entry,
                                ),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GROUP_BUY_DISCOUNT_MODES.map((mode) => (
                                <SelectItem key={mode} value={mode}>
                                  {mode === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={milestone.amount}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                participantMilestoneDiscounts: current.participantMilestoneDiscounts.map((entry) =>
                                  entry.id === milestone.id
                                    ? { ...entry, amount: Math.max(0, Number(event.target.value) || 0) }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-end justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                participantMilestoneDiscounts: moveItem(
                                  current.participantMilestoneDiscounts,
                                  index,
                                  -1,
                                ),
                              }))
                            }
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                participantMilestoneDiscounts: moveItem(
                                  current.participantMilestoneDiscounts,
                                  index,
                                  1,
                                ),
                              }))
                            }
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                participantMilestoneDiscounts: current.participantMilestoneDiscounts.filter(
                                  (entry) => entry.id !== milestone.id,
                                ),
                              }))
                            }
                            title="Remove milestone"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="space-y-2">
                  <Label>Refund Eligibility Window</Label>
                  <Input
                    type="number"
                    min="1"
                    value={draft.refundEligibilityWindowValue}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        refundEligibilityWindowValue: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Unit</Label>
                  <Select
                    value={draft.refundEligibilityWindowUnit}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        refundEligibilityWindowUnit: value as GroupBuySettings['refundEligibilityWindowUnit'],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_BUY_DURATION_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                <div>
                  <Label>Allow Admin Cancellation</Label>
                  <p className="text-xs text-muted-foreground">
                    Keep manual cancellation available for exception handling and operational cleanup.
                  </p>
                </div>
                <Switch
                  checked={draft.allowAdminCancellation}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, allowAdminCancellation: checked }))
                  }
                />
              </div>

              <div className="space-y-3">
                <Label>Automatic Refund Trigger Settings</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GROUP_BUY_REFUND_TRIGGERS.map((trigger) => (
                    <label
                      key={trigger}
                      className="flex items-center gap-3 rounded-xl border border-border/70 p-3 text-sm"
                    >
                      <Checkbox
                        checked={draft.automaticRefundTriggers.includes(trigger)}
                        onCheckedChange={(checked) =>
                          setDraft((current) => ({
                            ...current,
                            automaticRefundTriggers: checked
                              ? [...current.automaticRefundTriggers, trigger]
                              : current.automaticRefundTriggers.filter((entry) => entry !== trigger),
                          }))
                        }
                      />
                      <span>{REFUND_TRIGGER_LABELS[trigger]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cancellation Reason Templates</Label>
                <Textarea
                  rows={5}
                  value={draft.cancellationReasonTemplates.join('\n')}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      cancellationReasonTemplates: toTextList(event.target.value),
                    }))
                  }
                  placeholder="One cancellation reason per line"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Status Messages & Participant Notifications</CardTitle>
              <CardDescription>
                Rename the built-in fulfillment stages, control their customer-facing messages, and edit reusable group-buy notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                <div>
                  <Label>Automatic Participant Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Send lifecycle notifications when group-buy targets are reached, deals expire, or admins close them out.
                  </p>
                </div>
                <Switch
                  checked={draft.automaticParticipantNotifications}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, automaticParticipantNotifications: checked }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="space-y-2">
                  <Label>Estimated Processing Timeline</Label>
                  <Input
                    type="number"
                    min="1"
                    value={draft.estimatedProcessingTimelineValue}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        estimatedProcessingTimelineValue: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Unit</Label>
                  <Select
                    value={draft.estimatedProcessingTimelineUnit}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        estimatedProcessingTimelineUnit: value as GroupBuySettings['estimatedProcessingTimelineUnit'],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_BUY_DURATION_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estimated Processing Notes</Label>
                <Textarea
                  rows={3}
                  value={draft.estimatedProcessingTimelineNotes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      estimatedProcessingTimelineNotes: event.target.value,
                    }))
                  }
                  placeholder="Optional note shown beside the estimated processing duration"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Editable Fulfillment Stages</Label>
                  <p className="text-xs text-muted-foreground">
                    You can rename and reorder the current built-in stage list here, then reuse the matching customer message during updates.
                  </p>
                </div>
                <div className="space-y-3">
                  {draft.statusWorkflow.map((stage, index) => (
                    <div key={stage.key} className="rounded-xl border border-border/70 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{stage.key}</p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                statusWorkflow: moveItem(current.statusWorkflow, index, -1),
                              }))
                            }
                            title="Move stage up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                statusWorkflow: moveItem(current.statusWorkflow, index, 1),
                              }))
                            }
                            title="Move stage down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
                        <div className="space-y-2">
                          <Label>Stage Label</Label>
                          <Input
                            value={stage.label}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                statusWorkflow: current.statusWorkflow.map((entry) =>
                                  entry.key === stage.key
                                    ? { ...entry, label: event.target.value }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Customer Message</Label>
                          <Textarea
                            rows={2}
                            value={stage.message}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                statusWorkflow: current.statusWorkflow.map((entry) =>
                                  entry.key === stage.key
                                    ? { ...entry, message: event.target.value }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label>Notification Templates</Label>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Confirmation Notification</Label>
                    <Textarea
                      rows={3}
                      value={draft.notificationTemplates.confirmation}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          notificationTemplates: {
                            ...current.notificationTemplates,
                            confirmation: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shipping Update</Label>
                    <Textarea
                      rows={3}
                      value={draft.notificationTemplates.shippingUpdate}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          notificationTemplates: {
                            ...current.notificationTemplates,
                            shippingUpdate: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delay Notice</Label>
                    <Textarea
                      rows={3}
                      value={draft.notificationTemplates.delayNotice}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          notificationTemplates: {
                            ...current.notificationTemplates,
                            delayNotice: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery Notification</Label>
                    <Textarea
                      rows={3}
                      value={draft.notificationTemplates.deliveryNotification}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          notificationTemplates: {
                            ...current.notificationTemplates,
                            deliveryNotification: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Goal Reached</Label>
                    <Textarea
                      rows={3}
                      value={draft.notificationTemplates.goalReached}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          notificationTemplates: {
                            ...current.notificationTemplates,
                            goalReached: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expired</Label>
                    <Textarea
                      rows={3}
                      value={draft.notificationTemplates.expired}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          notificationTemplates: {
                            ...current.notificationTemplates,
                            expired: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Cancelled</Label>
                    <Textarea
                      rows={3}
                      value={draft.notificationTemplates.cancelled}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          notificationTemplates: {
                            ...current.notificationTemplates,
                            cancelled: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
