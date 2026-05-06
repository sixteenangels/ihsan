import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Ship, Plane, Package, Settings, AlertCircle } from 'lucide-react';

export interface ShippingRuleData {
  shipping_class_id: string;
  price: string;
  is_allowed: boolean;
}

interface ProductShippingRulesProps {
  rules: ShippingRuleData[];
  onRulesChange: (rules: ShippingRuleData[]) => void;
}

export function ProductShippingRules({ rules, onRulesChange }: ProductShippingRulesProps) {
  const { data: shippingClasses, isLoading } = useQuery({
    queryKey: ['shipping-classes-for-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_classes')
        .select(`
          *,
          shipping_types(id, name)
        `)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Initialize rules when shipping classes load
  useEffect(() => {
    if (shippingClasses && rules.length === 0) {
      const initialRules = shippingClasses.map((sc) => ({
        shipping_class_id: sc.id,
        price: String(sc.base_price || 0),
        is_allowed: true,
      }));
      onRulesChange(initialRules);
    }
  }, [shippingClasses, rules.length, onRulesChange]);

  const handleRuleChange = (classId: string, field: 'price' | 'is_allowed', value: string | boolean) => {
    const updatedRules = rules.map((rule) => {
      if (rule.shipping_class_id === classId) {
        return { ...rule, [field]: value };
      }
      return rule;
    });
    
    // If the rule doesn't exist yet, add it
    if (!updatedRules.find((r) => r.shipping_class_id === classId)) {
      const shippingClass = shippingClasses?.find((sc) => sc.id === classId);
      updatedRules.push({
        shipping_class_id: classId,
        price: field === 'price' ? (value as string) : String(shippingClass?.base_price || 0),
        is_allowed: field === 'is_allowed' ? (value as boolean) : true,
      });
    }
    
    onRulesChange(updatedRules);
  };

  const getRuleValue = (classId: string, field: 'price' | 'is_allowed') => {
    const rule = rules.find((r) => r.shipping_class_id === classId);
    if (rule) {
      return rule[field];
    }
    const shippingClass = shippingClasses?.find((sc) => sc.id === classId);
    return field === 'price' ? String(shippingClass?.base_price || 0) : true;
  };

  const getShippingIcon = (name: string) => {
    const lower = name?.toLowerCase() || '';
    if (lower.includes('sea')) return <Ship className="h-4 w-4" />;
    if (lower.includes('express')) return <Package className="h-4 w-4" />;
    return <Plane className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!shippingClasses || shippingClasses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <AlertCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-foreground mb-1">No Shipping Methods Configured</h4>
            <p className="text-sm text-muted-foreground mb-3">
              You need to set up shipping types and classes before you can assign shipping prices to products.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/shipping" className="inline-flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Go to Shipping Settings
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Product Shipping Prices</Label>
      <p className="text-sm text-muted-foreground">
        Set custom shipping prices for this product or disable specific shipping methods.
      </p>
      
      <div className="space-y-3">
        {shippingClasses.map((sc) => (
          <div
            key={sc.id}
            className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/30"
          >
            <div className="flex items-center gap-2 flex-1">
              <div className="p-2 rounded bg-primary/10 text-primary">
                {getShippingIcon((sc.shipping_types as any)?.name || '')}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{sc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(sc.shipping_types as any)?.name} • {sc.estimated_days_min}-{sc.estimated_days_max} days
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor={`price-${sc.id}`} className="text-xs text-muted-foreground">
                  Price
                </Label>
                <Input
                  id={`price-${sc.id}`}
                  type="number"
                  step="0.01"
                  className="w-24 h-8 text-sm"
                  value={getRuleValue(sc.id, 'price') as string}
                  onChange={(e) => handleRuleChange(sc.id, 'price', e.target.value)}
                  disabled={!(getRuleValue(sc.id, 'is_allowed') as boolean)}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor={`allowed-${sc.id}`} className="text-xs text-muted-foreground">
                  Enabled
                </Label>
                <Switch
                  id={`allowed-${sc.id}`}
                  checked={getRuleValue(sc.id, 'is_allowed') as boolean}
                  onCheckedChange={(checked) => handleRuleChange(sc.id, 'is_allowed', checked)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}