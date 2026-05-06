import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useMessageTemplates, useSaveTemplate, useDeleteTemplate } from '@/hooks/useMessageTemplates';

export function AdminMessageTemplates() {
  const { data: templates, isLoading } = useMessageTemplates();
  const saveMutation = useSaveTemplate();
  const deleteMutation = useDeleteTemplate();

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      toast.error('Name and content are required');
      return;
    }
    try {
      await saveMutation.mutateAsync({ name: name.trim(), content: content.trim(), category: category.trim() || undefined });
      toast.success('Template saved');
      setName('');
      setContent('');
      setCategory('');
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif text-foreground flex items-center gap-2">
          <MessageSquare className="h-7 w-7 text-primary" />
          Message Templates
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Message Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Courier dispatched" />
              </div>
              <div>
                <Label>Category (optional)</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Shipping, Delays" />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder="Reusable message text. You can edit before sending."
                />
              </div>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
      ) : (templates || []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No templates yet. Create one to speed up status updates.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {(templates || []).map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">{t.name}</CardTitle>
                  {t.category && <Badge variant="outline" className="mt-1">{t.category}</Badge>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(t.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
