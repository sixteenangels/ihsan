import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/audit-log';

interface CategoryForm {
  name: string;
  slug: string;
  icon: string;
  is_active: boolean;
}

const defaultForm: CategoryForm = {
  name: '',
  slug: '',
  icon: '📦',
  is_active: true,
};

const EMOJI_PRESETS = ['📦', '🛍️', '👑', '🧴', '🍱', '🏠', '💄', '🧸', '🪑', '🎒', '📚', '🎮', '💻', '🍯', '✨', '🌿'];

export function AdminCategories() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(defaultForm);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CategoryForm) => {
      const payload = {
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
        icon: data.icon,
        is_active: data.is_active,
      };

      const { data: created, error } = await supabase
        .from('categories')
        .insert(payload as any)
        .select('id')
        .single();
      if (error) throw error;

      await logAdminAction({
        actorUserId: user?.id,
        action: 'category.created',
        entityType: 'category',
        entityId: created.id,
        summary: `Created category ${data.name}.`,
        metadata: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category created successfully');
      setIsOpen(false);
      setForm(defaultForm);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoryForm }) => {
      const payload = {
        name: data.name,
        slug: data.slug,
        icon: data.icon,
        is_active: data.is_active,
      };

      const { error } = await supabase
        .from('categories')
        .update(payload as any)
        .eq('id', id);
      if (error) throw error;

      await logAdminAction({
        actorUserId: user?.id,
        action: 'category.updated',
        entityType: 'category',
        entityId: id,
        summary: `Updated category ${data.name}.`,
        metadata: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category updated successfully');
      setIsOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;

      await logAdminAction({
        actorUserId: user?.id,
        action: 'category.deleted',
        entityType: 'category',
        entityId: id,
        summary: `Deleted category ${name}.`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEdit = (category: any) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      icon: category.icon || '📦',
      is_active: category.is_active ?? true,
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif text-foreground">Categories</h1>
        <Dialog open={isOpen} onOpenChange={(open) => !open ? handleClose() : setIsOpen(true)}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setForm(defaultForm); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Category' : 'Add New Category'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="auto-generated from name if empty"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="icon">Icon (emoji)</Label>
                <Input
                  id="icon"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="Pick an emoji"
                />
                <div className="grid grid-cols-8 gap-2 rounded-lg border border-border p-3">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`rounded-lg border p-2 text-xl transition-colors ${
                        form.icon === emoji ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setForm({ ...form, icon: emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Use one of the presets, or use your device emoji keyboard in the field for any emoji you want.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_active: checked })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Icon</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category: any) => (
                  <TableRow key={category.id}>
                    <TableCell className="text-2xl">{category.icon || '📦'}</TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                    <TableCell>{category.product_count || 0}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs ${
                          category.is_active
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {category.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate({ id: category.id, name: category.name })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No categories yet. Add your first category to get started.
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
