import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Ship, Plane, Package } from 'lucide-react';
import { shippingClassSchema, shippingTypeSchema, validateForm } from '@/lib/validations/admin';

export function AdminShipping() {
  const queryClient = useQueryClient();
  const [isAddingType, setIsAddingType] = useState(false);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [newType, setNewType] = useState({ name: '', description: '' });
  const [newClass, setNewClass] = useState({
    name: '',
    shipping_type_id: '',
    base_price: '',
    estimated_days_min: '',
    estimated_days_max: '',
  });

  const { data: shippingTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['admin-shipping-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_types')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: shippingClasses, isLoading: classesLoading } = useQuery({
    queryKey: ['admin-shipping-classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_classes')
        .select(`
          *,
          shipping_types(id, name)
        `)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const handleAddType = () => {
    const validation = validateForm(shippingTypeSchema, newType);
    if (!validation.success) {
      const firstError = Object.values(validation.errors || {})[0];
      toast.error(firstError || 'Please fix the form errors');
      return;
    }
    addTypeMutation.mutate(newType);
  };

  const addTypeMutation = useMutation({
    mutationFn: async (typeData: { name: string; description: string }) => {
      const { error } = await supabase.from('shipping_types').insert(typeData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-types'] });
      toast.success('Shipping type added');
      setIsAddingType(false);
      setNewType({ name: '', description: '' });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleAddClass = () => {
    const validation = validateForm(shippingClassSchema, newClass);
    if (!validation.success) {
      const firstError = Object.values(validation.errors || {})[0];
      toast.error(firstError || 'Please fix the form errors');
      return;
    }
    addClassMutation.mutate(newClass);
  };

  const handleUpdateClass = () => {
    if (!editingClass) return;
    const validation = validateForm(shippingClassSchema, {
      name: editingClass.name,
      shipping_type_id: editingClass.shipping_type_id,
      base_price: String(editingClass.base_price),
      estimated_days_min: String(editingClass.estimated_days_min),
      estimated_days_max: String(editingClass.estimated_days_max),
    });
    if (!validation.success) {
      const firstError = Object.values(validation.errors || {})[0];
      toast.error(firstError || 'Please fix the form errors');
      return;
    }
    updateClassMutation.mutate(editingClass);
  };

  const addClassMutation = useMutation({
    mutationFn: async (classData: any) => {
      const { error } = await supabase.from('shipping_classes').insert({
        name: classData.name,
        shipping_type_id: classData.shipping_type_id,
        base_price: parseFloat(classData.base_price),
        estimated_days_min: parseInt(classData.estimated_days_min),
        estimated_days_max: parseInt(classData.estimated_days_max),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-classes'] });
      toast.success('Shipping class added');
      setIsAddingClass(false);
      setNewClass({ name: '', shipping_type_id: '', base_price: '', estimated_days_min: '', estimated_days_max: '' });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateClassMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from('shipping_classes')
        .update({
          name: data.name,
          base_price: parseFloat(data.base_price),
          estimated_days_min: parseInt(data.estimated_days_min),
          estimated_days_max: parseInt(data.estimated_days_max),
          is_active: data.is_active,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-classes'] });
      toast.success('Shipping class updated');
      setEditingClass(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shipping_classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-classes'] });
      toast.success('Shipping class deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleTypeActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('shipping_types')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-types'] });
      toast.success('Shipping type updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const getShippingIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('sea')) return <Ship className="h-5 w-5" />;
    if (lower.includes('express')) return <Package className="h-5 w-5" />;
    return <Plane className="h-5 w-5" />;
  };

  if (typesLoading || classesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-serif text-foreground mb-8">Shipping Management</h1>

      {/* Shipping Types */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shipping Types</CardTitle>
          <Dialog open={isAddingType} onOpenChange={setIsAddingType}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Shipping Type</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newType.name}
                    onChange={(e) => setNewType(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Sea Shipping"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newType.description}
                    onChange={(e) => setNewType(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Shipping by sea cargo"
                  />
                </div>
                <Button
                  onClick={handleAddType}
                  disabled={!newType.name}
                >
                  Add Type
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {shippingTypes?.map((type) => (
              <div key={type.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {getShippingIcon(type.name)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{type.name}</p>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                </div>
                <Switch
                  checked={type.is_active ?? true}
                  onCheckedChange={(checked) => toggleTypeActive.mutate({ id: type.id, is_active: checked })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Shipping Classes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shipping Classes (Price & Duration)</CardTitle>
          <Dialog open={isAddingClass} onOpenChange={setIsAddingClass}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Shipping Class</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newClass.name}
                    onChange={(e) => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Standard Sea"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shipping Type</Label>
                  <Select
                    value={newClass.shipping_type_id}
                    onValueChange={(value) => setNewClass(prev => ({ ...prev, shipping_type_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {shippingTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Base Price</Label>
                  <Input
                    type="number"
                    value={newClass.base_price}
                    onChange={(e) => setNewClass(prev => ({ ...prev, base_price: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Min Days</Label>
                    <Input
                      type="number"
                      value={newClass.estimated_days_min}
                      onChange={(e) => setNewClass(prev => ({ ...prev, estimated_days_min: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Days</Label>
                    <Input
                      type="number"
                      value={newClass.estimated_days_max}
                      onChange={(e) => setNewClass(prev => ({ ...prev, estimated_days_max: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddClass}
                  disabled={!newClass.name || !newClass.shipping_type_id || !newClass.base_price}
                >
                  Add Class
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {shippingClasses?.map((shippingClass) => (
              <div key={shippingClass.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {getShippingIcon((shippingClass.shipping_types as any)?.name || '')}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{shippingClass.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(shippingClass.shipping_types as any)?.name} • {shippingClass.estimated_days_min}-{shippingClass.estimated_days_max} days
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold text-primary">${Number(shippingClass.base_price).toFixed(2)}</p>
                  <Switch
                    checked={shippingClass.is_active ?? true}
                    onCheckedChange={(checked) => updateClassMutation.mutate({ id: shippingClass.id, ...shippingClass, is_active: checked })}
                  />
                  <Dialog open={editingClass?.id === shippingClass.id} onOpenChange={(open) => !open && setEditingClass(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setEditingClass(shippingClass)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Shipping Class</DialogTitle>
                      </DialogHeader>
                      {editingClass && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={editingClass.name}
                              onChange={(e) => setEditingClass((prev: any) => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Base Price</Label>
                            <Input
                              type="number"
                              value={editingClass.base_price}
                              onChange={(e) => setEditingClass((prev: any) => ({ ...prev, base_price: e.target.value }))}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <Label>Min Days</Label>
                              <Input
                                type="number"
                                value={editingClass.estimated_days_min}
                                onChange={(e) => setEditingClass((prev: any) => ({ ...prev, estimated_days_min: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Max Days</Label>
                              <Input
                                type="number"
                                value={editingClass.estimated_days_max}
                                onChange={(e) => setEditingClass((prev: any) => ({ ...prev, estimated_days_max: e.target.value }))}
                              />
                            </div>
                          </div>
                          <Button onClick={handleUpdateClass}>
                            Save Changes
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteClassMutation.mutate(shippingClass.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
