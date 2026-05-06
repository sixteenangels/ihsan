import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Package } from 'lucide-react';

export function AdminBundles() {
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState('');
  const [bundledProductId, setBundledProductId] = useState('');

  const { data: products } = useQuery({
    queryKey: ['admin-products-list'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: bundles, isLoading } = useQuery({
    queryKey: ['admin-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('id, product_id, bundled_product_id, products!product_bundles_product_id_fkey(name), bundled:products!product_bundles_bundled_product_id_fkey(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!productId || !bundledProductId) throw new Error('Select both products');
      if (productId === bundledProductId) throw new Error('Cannot bundle a product with itself');
      const { error } = await supabase.from('product_bundles').insert({
        product_id: productId,
        bundled_product_id: bundledProductId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bundles'] });
      toast.success('Bundle created');
      setProductId('');
      setBundledProductId('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_bundles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bundles'] });
      toast.success('Bundle removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-serif text-foreground">Product Bundles</h1>
      <p className="text-muted-foreground">Manage "Frequently Bought Together" product pairings.</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Bundle Pairing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Main Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bundled With</Label>
              <Select value={bundledProductId} onValueChange={setBundledProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products?.filter((p) => p.id !== productId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !productId || !bundledProductId}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Bundle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Main Product</TableHead>
                  <TableHead>Bundled With</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundles?.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.products?.name || '-'}</TableCell>
                    <TableCell>{b.bundled?.name || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!bundles || bundles.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No bundles yet. Add your first product pairing above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
