import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Loader2, Package, Archive, ArchiveRestore } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { ProductImageUpload, uploadProductImages } from './ProductImageUpload';
import { ProductVariantsManager, VariantData } from './ProductVariantsManager';
import { ProductShippingRules, ShippingRuleData } from './ProductShippingRules';
import { productSchema, validateForm } from '@/lib/validations/admin';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/audit-log';
import type { Database } from '@/integrations/supabase/types';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];
type ProductImageRow = Database['public']['Tables']['product_images']['Row'];
type ProductCategoryRelation = { name: string };
type ProductOpsFields = {
  supplier_name: string | null;
  supplier_sku: string | null;
  procurement_notes: string | null;
  expected_restock_date: string | null;
};
type AdminProduct = ProductRow &
  ProductOpsFields & {
    categories: ProductCategoryRelation | null;
    product_images: Pick<ProductImageRow, 'id' | 'image_url' | 'order_index'>[] | null;
  };

interface ProductForm {
  name: string;
  description: string;
  item_code: string;
  base_price: string;
  group_buy_price: string;
  category_id: string;
  is_group_buy_eligible: boolean;
  is_flash_deal: boolean;
  flash_deal_ends_at: string;
  is_free_shipping: boolean;
  is_ready_now: boolean;
  is_active: boolean;
  is_fragile: boolean;
  allow_standard_packaging: boolean;
  allow_reinforced_packaging: boolean;
  reinforced_packaging_cost: string;
  supplier_name: string;
  supplier_sku: string;
  procurement_notes: string;
  expected_restock_date: string;
}

const defaultForm: ProductForm = {
  name: '',
  description: '',
  item_code: '',
  base_price: '',
  group_buy_price: '',
  category_id: '',
  is_group_buy_eligible: false,
  is_flash_deal: false,
  flash_deal_ends_at: '',
  is_free_shipping: false,
  is_ready_now: false,
  is_active: true,
  is_fragile: false,
  allow_standard_packaging: true,
  allow_reinforced_packaging: true,
  reinforced_packaging_cost: '',
  supplier_name: '',
  supplier_sku: '',
  procurement_notes: '',
  expected_restock_date: '',
};

async function uploadVariantImage(productId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${productId}/variants/${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export function AdminProducts() {
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<Pick<ProductImageRow, 'id' | 'image_url' | 'order_index'>[]>([]);
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [shippingRules, setShippingRules] = useState<ShippingRuleData[]>([]);

  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), product_images(id, image_url, order_index)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminProduct[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductForm) => {
      const productPayload: ProductInsert & ProductOpsFields = {
        name: data.name,
        description: data.description,
        item_code: data.item_code,
        base_price: parseFloat(data.base_price),
        group_buy_price: data.group_buy_price ? parseFloat(data.group_buy_price) : null,
        category_id: data.category_id || null,
        is_group_buy_eligible: data.is_group_buy_eligible,
        is_flash_deal: data.is_flash_deal,
        flash_deal_ends_at: data.is_flash_deal && data.flash_deal_ends_at ? new Date(data.flash_deal_ends_at).toISOString() : null,
        is_free_shipping: data.is_free_shipping,
        is_ready_now: data.is_ready_now,
        is_active: data.is_active ?? true,
        is_fragile: data.is_fragile,
        allow_standard_packaging: data.allow_standard_packaging,
        allow_reinforced_packaging: data.allow_reinforced_packaging,
        reinforced_packaging_cost: data.reinforced_packaging_cost ? parseFloat(data.reinforced_packaging_cost) : null,
        supplier_name: data.supplier_name || null,
        supplier_sku: data.supplier_sku || null,
        procurement_notes: data.procurement_notes || null,
        expected_restock_date: data.expected_restock_date || null,
      };

      const { data: product, error } = await supabase
        .from('products')
        .insert(productPayload as ProductInsert)
        .select()
        .single();
      if (error) throw error;

      // Upload images if any
      if (pendingImages.length > 0 && product) {
        const imageUrls = await uploadProductImages(product.id, pendingImages);
        const imageRecords: Database['public']['Tables']['product_images']['Insert'][] = imageUrls.map((url, index) => ({
          product_id: product.id,
          image_url: url,
          order_index: index,
        }));
        await supabase.from('product_images').insert(imageRecords);
      }

      // Create variants if any
      if (variants.length > 0 && product) {
        const variantRecords: Database['public']['Tables']['product_variants']['Insert'][] = await Promise.all(
          variants.map(async (v) => ({
            product_id: product.id,
            size: v.size || null,
            color: v.color || null,
            price_override: v.price_override ? parseFloat(v.price_override) : null,
            stock: parseInt(v.stock) || 0,
            sku: v.sku || null,
            variant_image_url: v.image_file
              ? await uploadVariantImage(product.id, v.image_file)
              : v.image_url || null,
          })),
        );
        await supabase.from('product_variants').insert(variantRecords);
      }

      // Create shipping rules if any
      if (shippingRules.length > 0 && product) {
        const ruleRecords: Database['public']['Tables']['product_shipping_rules']['Insert'][] = shippingRules.map((r) => ({
          product_id: product.id,
          shipping_class_id: r.shipping_class_id,
          price: parseFloat(r.price) || 0,
          is_allowed: r.is_allowed,
        }));
        await supabase.from('product_shipping_rules').insert(ruleRecords);
      }

      await logAdminAction({
        actorUserId: user?.id,
        action: 'product.created',
        entityType: 'product',
        entityId: product.id,
        summary: `Created product ${data.name}.`,
        metadata: {
          itemCode: data.item_code,
          categoryId: data.category_id || null,
          basePrice: parseFloat(data.base_price),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully');
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductForm }) => {
      const productPayload: ProductUpdate & ProductOpsFields = {
        name: data.name,
        description: data.description,
        item_code: data.item_code,
        base_price: parseFloat(data.base_price),
        group_buy_price: data.group_buy_price ? parseFloat(data.group_buy_price) : null,
        category_id: data.category_id || null,
        is_group_buy_eligible: data.is_group_buy_eligible,
        is_flash_deal: data.is_flash_deal,
        flash_deal_ends_at: data.is_flash_deal && data.flash_deal_ends_at ? new Date(data.flash_deal_ends_at).toISOString() : null,
        is_free_shipping: data.is_free_shipping,
        is_ready_now: data.is_ready_now,
        is_active: data.is_active ?? true,
        is_fragile: data.is_fragile,
        allow_standard_packaging: data.allow_standard_packaging,
        allow_reinforced_packaging: data.allow_reinforced_packaging,
        reinforced_packaging_cost: data.reinforced_packaging_cost ? parseFloat(data.reinforced_packaging_cost) : null,
        supplier_name: data.supplier_name || null,
        supplier_sku: data.supplier_sku || null,
        procurement_notes: data.procurement_notes || null,
        expected_restock_date: data.expected_restock_date || null,
      };

      const { error } = await supabase
        .from('products')
        .update(productPayload as ProductUpdate)
        .eq('id', id);
      if (error) throw error;

      // Upload new images if any
      if (pendingImages.length > 0) {
        const currentMaxIndex = existingImages.length > 0 
          ? Math.max(...existingImages.map(i => i.order_index)) + 1 
          : 0;
        const imageUrls = await uploadProductImages(id, pendingImages);
        const imageRecords: Database['public']['Tables']['product_images']['Insert'][] = imageUrls.map((url, index) => ({
          product_id: id,
          image_url: url,
          order_index: currentMaxIndex + index,
        }));
        await supabase.from('product_images').insert(imageRecords);
      }

      // Handle variants: delete existing and insert new
      await supabase.from('product_variants').delete().eq('product_id', id);
      if (variants.length > 0) {
        const variantRecords: Database['public']['Tables']['product_variants']['Insert'][] = await Promise.all(
          variants.map(async (v) => ({
            product_id: id,
            size: v.size || null,
            color: v.color || null,
            price_override: v.price_override ? parseFloat(v.price_override) : null,
            stock: parseInt(v.stock) || 0,
            sku: v.sku || null,
            variant_image_url: v.image_file
              ? await uploadVariantImage(id, v.image_file)
              : v.image_url || null,
          })),
        );
        await supabase.from('product_variants').insert(variantRecords);
      }

      // Handle shipping rules: delete existing and insert new
      await supabase.from('product_shipping_rules').delete().eq('product_id', id);
      if (shippingRules.length > 0) {
        const ruleRecords: Database['public']['Tables']['product_shipping_rules']['Insert'][] = shippingRules.map((r) => ({
          product_id: id,
          shipping_class_id: r.shipping_class_id,
          price: parseFloat(r.price) || 0,
          is_allowed: r.is_allowed,
        }));
        await supabase.from('product_shipping_rules').insert(ruleRecords);
      }

      await logAdminAction({
        actorUserId: user?.id,
        action: 'product.updated',
        entityType: 'product',
        entityId: id,
        summary: `Updated product ${data.name}.`,
        metadata: {
          itemCode: data.item_code,
          categoryId: data.category_id || null,
          supplierName: data.supplier_name || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated successfully');
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, nextActive }: { id: string; nextActive: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({
          is_active: nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;

      await logAdminAction({
        actorUserId: user?.id,
        action: nextActive ? 'product.restored' : 'product.archived',
        entityType: 'product',
        entityId: id,
        summary: `${nextActive ? 'Restored' : 'Archived'} product ${id}.`,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(variables.nextActive ? 'Product restored successfully' : 'Product archived successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEdit = async (product: AdminProduct) => {
    try {
      setEditingId(product.id);
      setForm({
        name: product.name || '',
        description: product.description || '',
        item_code: product.item_code || '',
        base_price: String(product.base_price || 0),
        group_buy_price: product.group_buy_price != null ? String(product.group_buy_price) : '',
        category_id: product.category_id || '',
        is_group_buy_eligible: product.is_group_buy_eligible || false,
        is_flash_deal: product.is_flash_deal || false,
        flash_deal_ends_at: product.flash_deal_ends_at ? new Date(product.flash_deal_ends_at).toISOString().slice(0, 16) : '',
        is_free_shipping: product.is_free_shipping || false,
        is_ready_now: product.is_ready_now || false,
        is_active: product.is_active ?? true,
        is_fragile: product.is_fragile || false,
        allow_standard_packaging: product.allow_standard_packaging !== false,
        allow_reinforced_packaging: product.allow_reinforced_packaging !== false,
        reinforced_packaging_cost: product.reinforced_packaging_cost != null ? String(product.reinforced_packaging_cost) : '',
        supplier_name: product.supplier_name || '',
        supplier_sku: product.supplier_sku || '',
        procurement_notes: product.procurement_notes || '',
        expected_restock_date: product.expected_restock_date || '',
      });
      setExistingImages(product.product_images || []);
      setPendingImages([]);
      
      // Load existing variants
      const { data: existingVariants } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id);
      
      if (existingVariants) {
        setVariants(existingVariants.map(v => ({
          id: v.id,
          size: v.size || '',
          color: v.color || '',
          price_override: v.price_override ? String(v.price_override) : '',
          stock: String(v.stock || 0),
          sku: v.sku || '',
          image_url: v.variant_image_url || null,
          image_file: null,
          image_preview_url: null,
        })));
      } else {
        setVariants([]);
      }

      // Load existing shipping rules
      const { data: existingRules } = await supabase
        .from('product_shipping_rules')
        .select('*')
        .eq('product_id', product.id);

      if (existingRules) {
        setShippingRules(existingRules.map(r => ({
          shipping_class_id: r.shipping_class_id,
          price: String(r.price || 0),
          is_allowed: r.is_allowed ?? true,
        })));
      } else {
        setShippingRules([]);
      }

      setIsOpen(true);
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Error loading product details');
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setPendingImages([]);
    setExistingImages([]);
    setVariants([]);
    setShippingRules([]);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateForm(productSchema, form);
    if (!validation.success) {
      const firstError = Object.values(validation.errors || {})[0];
      toast.error(firstError || 'Please fix the form errors');
      return;
    }
    
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm(defaultForm);
    setPendingImages([]);
    setExistingImages([]);
    setVariants([]);
    setShippingRules([]);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <h1 className="text-2xl font-bold font-serif text-foreground md:text-3xl">Products</h1>
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAdd} className="self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-background">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item_code">Item Code *</Label>
                  <Input
                    id="item_code"
                    value={form.item_code}
                    onChange={(e) => setForm({ ...form, item_code: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="rounded-lg border border-border p-4 space-y-4">
                <div>
                  <h3 className="font-medium text-foreground">Internal Sourcing</h3>
                  <p className="text-xs text-muted-foreground">
                    Internal-only supplier and procurement notes for inventory planning.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplier_name">Supplier Name</Label>
                    <Input
                      id="supplier_name"
                      value={form.supplier_name}
                      onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier_sku">Supplier SKU</Label>
                    <Input
                      id="supplier_sku"
                      value={form.supplier_sku}
                      onChange={(e) => setForm({ ...form, supplier_sku: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="expected_restock_date">Expected Restock Date</Label>
                    <Input
                      id="expected_restock_date"
                      type="date"
                      value={form.expected_restock_date}
                      onChange={(e) => setForm({ ...form, expected_restock_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="procurement_notes">Procurement Notes</Label>
                    <Textarea
                      id="procurement_notes"
                      value={form.procurement_notes}
                      onChange={(e) => setForm({ ...form, procurement_notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="base_price">Base Price *</Label>
                  <Input
                    id="base_price"
                    type="number"
                    step="0.01"
                    value={form.base_price}
                    onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group_buy_price">Group Buy Price</Label>
                  <Input
                    id="group_buy_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.group_buy_price}
                    onChange={(e) => setForm({ ...form, group_buy_price: e.target.value })}
                    placeholder="Optional fixed group-buy price"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={form.category_id}
                    onValueChange={(value) => setForm({ ...form, category_id: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-popover border border-border shadow-lg">
                      {categoriesLoading ? (
                        <div className="p-2 text-center text-muted-foreground">Loading...</div>
                      ) : categories && categories.length > 0 ? (
                        categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} className="cursor-pointer">
                            {cat.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-center text-muted-foreground">No categories available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <Label htmlFor="is_group_buy_eligible" className="min-w-0">Group Buy Eligible</Label>
                  <Switch
                    className="shrink-0"
                    id="is_group_buy_eligible"
                    checked={form.is_group_buy_eligible}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, is_group_buy_eligible: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <Label htmlFor="is_flash_deal" className="min-w-0">Flash Deal</Label>
                  <Switch
                    className="shrink-0"
                    id="is_flash_deal"
                    checked={form.is_flash_deal}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, is_flash_deal: checked })
                    }
                  />
                </div>
              </div>

              {form.is_flash_deal && (
                <div className="space-y-2">
                  <Label htmlFor="flash_deal_ends_at">Flash Deal End Time</Label>
                  <Input
                    id="flash_deal_ends_at"
                    type="datetime-local"
                    value={form.flash_deal_ends_at}
                    onChange={(e) => setForm({ ...form, flash_deal_ends_at: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <Label htmlFor="is_free_shipping" className="min-w-0">Free Shipping</Label>
                  <Switch
                    className="shrink-0"
                    id="is_free_shipping"
                    checked={form.is_free_shipping}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, is_free_shipping: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <Label htmlFor="is_active" className="min-w-0">Active</Label>
                  <Switch
                    className="shrink-0"
                    id="is_active"
                    checked={form.is_active}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, is_active: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/50 bg-primary/5 p-3">
                <div className="min-w-0">
                  <Label htmlFor="is_ready_now" className="text-primary font-semibold">Ready Now</Label>
                  <p className="text-xs text-muted-foreground">Mark as immediately available for shipping</p>
                </div>
                <Switch
                  className="shrink-0"
                  id="is_ready_now"
                  checked={form.is_ready_now}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_ready_now: checked })
                  }
                />
              </div>

              <div className="rounded-lg border border-amber-500/50 p-3 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="is_fragile" className="text-amber-700 dark:text-amber-300 font-semibold">Fragile Item</Label>
                    <p className="text-xs text-muted-foreground">Customer will see Standard / Reinforced packaging choice at checkout</p>
                  </div>
                  <Switch
                    className="shrink-0"
                    id="is_fragile"
                    checked={form.is_fragile}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, is_fragile: checked })
                    }
                  />
                </div>
                {form.is_fragile && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <Label htmlFor="allow_standard_packaging" className="min-w-0">Standard Packaging</Label>
                        <Switch
                          className="shrink-0"
                          id="allow_standard_packaging"
                          checked={form.allow_standard_packaging}
                          onCheckedChange={(checked) =>
                            setForm({ ...form, allow_standard_packaging: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <Label htmlFor="allow_reinforced_packaging" className="min-w-0">Reinforced Protection</Label>
                        <Switch
                          className="shrink-0"
                          id="allow_reinforced_packaging"
                          checked={form.allow_reinforced_packaging}
                          onCheckedChange={(checked) =>
                            setForm({ ...form, allow_reinforced_packaging: checked })
                          }
                        />
                      </div>
                    </div>
                    <Label htmlFor="reinforced_packaging_cost">Reinforced Packaging Cost (₵) — leave blank to use store default</Label>
                    <Input
                      id="reinforced_packaging_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.reinforced_packaging_cost}
                      onChange={(e) => setForm({ ...form, reinforced_packaging_cost: e.target.value })}
                      placeholder="e.g. 25.00"
                    />
                  </div>
                )}
              </div>

              {/* Image Upload Section */}
              <div className="border-t border-border pt-4">
                <ProductImageUpload
                  productId={editingId || undefined}
                  existingImages={existingImages}
                  pendingImages={pendingImages}
                  onImagesChange={setPendingImages}
                />
              </div>

              {/* Variants Section */}
              <div className="border-t border-border pt-4">
                <ProductVariantsManager
                  variants={variants}
                  onVariantsChange={setVariants}
                  basePrice={form.base_price}
                />
              </div>

              {/* Shipping Rules Section */}
              <div className="border-t border-border pt-4">
                <ProductShippingRules
                  rules={shippingRules}
                  onRulesChange={setShippingRules}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No products yet. Add your first product to get started.
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {products.map((product) => {
                  const firstImage = product.product_images?.[0]?.image_url;

                  return (
                    <div key={product.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        {firstImage ? (
                          <img
                            src={firstImage}
                            alt={product.name}
                            className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{product.name}</p>
                            {product.is_ready_now && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                                Ready
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] ${
                                product.is_active
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {product.is_active ? 'Active' : 'Archived'}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {product.categories?.name || '-'}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            {formatPrice(product.base_price)}
                          </p>
                          {(product.supplier_name || product.expected_restock_date) && (
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <p>{product.supplier_name || 'No supplier'}</p>
                              {product.expected_restock_date && (
                                <p>Restock {String(product.expected_restock_date)}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() =>
                            archiveMutation.mutate({
                              id: product.id,
                              nextActive: !product.is_active,
                            })
                          }
                        >
                          {product.is_active ? (
                            <Archive className="mr-2 h-4 w-4 text-amber-600" />
                          ) : (
                            <ArchiveRestore className="mr-2 h-4 w-4 text-primary" />
                          )}
                          {product.is_active ? 'Archive' : 'Restore'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Image</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const firstImage = product.product_images?.[0]?.image_url;

                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            {firstImage ? (
                              <img
                                src={firstImage}
                                alt={product.name}
                                className="h-12 w-12 rounded-md border border-border object-cover"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {product.name}
                            {product.is_ready_now && (
                              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                Ready
                              </span>
                            )}
                            {(product.supplier_name || product.expected_restock_date) && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {product.supplier_name || 'No supplier'}
                                {product.expected_restock_date ? ` - Restock ${String(product.expected_restock_date)}` : ''}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{product.categories?.name || '-'}</TableCell>
                          <TableCell>{formatPrice(product.base_price)}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs ${
                                product.is_active
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {product.is_active ? 'Active' : 'Archived'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(product)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  archiveMutation.mutate({
                                    id: product.id,
                                    nextActive: !product.is_active,
                                  })
                                }
                                title={product.is_active ? 'Archive product' : 'Restore product'}
                                aria-label={product.is_active ? 'Archive product' : 'Restore product'}
                              >
                                {product.is_active ? (
                                  <Archive className="h-4 w-4 text-amber-600" />
                                ) : (
                                  <ArchiveRestore className="h-4 w-4 text-primary" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
