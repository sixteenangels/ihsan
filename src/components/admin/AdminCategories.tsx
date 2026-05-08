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
import { CategoryIconDisplay } from '@/components/categories/CategoryIconDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/audit-log';
import type { Database } from '@/integrations/supabase/types';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

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
      return (data || []) as CategoryRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CategoryForm) => {
      const payload: CategoryInsert = {
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
        icon: data.icon,
        is_active: data.is_active,
      };

      const { data: created, error } = await supabase
        .from('categories')
        .insert(payload)
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
      const payload: CategoryUpdate = {
        name: data.name,
        slug: data.slug,
        icon: data.icon,
        is_active: data.is_active,
      };

      const { error } = await supabase
        .from('categories')
        .update(payload)
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

  const handleEdit = (category: CategoryRow) => {
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <h1 className="text-2xl font-bold font-serif text-foreground md:text-3xl">Categories</h1>
        <Dialog open={isOpen} onOpenChange={(open) => !open ? handleClose() : setIsOpen(true)}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setForm(defaultForm); }} className="self-start sm:self-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-lg">
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
                <Label htmlFor="icon">Icon</Label>
                <Input
                  id="icon"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="Emoji, SVG URL, image URL, or inline SVG"
                />
                <div className="grid grid-cols-4 gap-2 rounded-lg border border-border p-3 sm:grid-cols-8">
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
                  Use a preset emoji, or paste a custom emoji, SVG URL, image URL, or inline SVG markup.
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

              <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
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
          ) : categories.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No categories yet. Add your first category to get started.
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {categories.map((category) => (
                  <div key={category.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
                        <CategoryIconDisplay
                          categoryName={category.name}
                          icon={category.icon}
                          className="h-6 w-6"
                          emojiClassName="text-2xl"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{category.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              category.is_active
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {category.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{category.slug}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {category.product_count || 0} products
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleEdit(category)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => deleteMutation.mutate({ id: category.id, name: category.name })}
                      >
                        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
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
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            <CategoryIconDisplay
                              categoryName={category.name}
                              icon={category.icon}
                              className="h-5 w-5"
                              emojiClassName="text-xl"
                            />
                          </div>
                        </TableCell>
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
