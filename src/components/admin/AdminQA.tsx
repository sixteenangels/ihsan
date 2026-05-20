import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type ProductQuestionRow = Tables<'product_questions'> & {
  products: Pick<Tables<'products'>, 'name'> | null;
  profiles: Pick<Tables<'profiles'>, 'name' | 'email'> | null;
};

export function AdminQA() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const { data: questions, isLoading } = useQuery({
    queryKey: ['admin-questions'],
    queryFn: async (): Promise<ProductQuestionRow[]> => {
      const { data, error } = await supabase
        .from('product_questions')
        .select('*, products(name), profiles:user_id(name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProductQuestionRow[];
    },
  });

  const answerMutation = useMutation({
    mutationFn: async ({ id, answer }: { id: string; answer: string }) => {
      const { error } = await supabase
        .from('product_questions')
        .update({
          answer,
          answered_by: user?.id,
          answered_at: new Date().toISOString(),
          is_published: true,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
      toast.success('Answer submitted');
    },
    onError: () => toast.error('Failed to submit answer'),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { error } = await supabase
        .from('product_questions')
        .update({ is_published: published })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
      toast.success('Updated');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const unanswered = questions?.filter((question) => !question.answer).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Product Q&A</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{unanswered} Unanswered</Badge>
          <Badge variant="secondary">{(questions?.length || 0) - unanswered} Answered</Badge>
        </div>
      </div>

      {questions?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No questions yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions?.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{q.question}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      on <span className="font-medium">{q.products?.name}</span>
                      {' · by '}
                      {q.profiles?.name || q.profiles?.email || 'Unknown'}
                      {' · '}
                      {format(new Date(q.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">Published</span>
                    <Switch
                      checked={q.is_published}
                      onCheckedChange={(checked) => togglePublish.mutate({ id: q.id, published: checked })}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {q.answer ? (
                  <div className="p-3 bg-primary/5 rounded-lg border-l-2 border-primary">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Your answer:</p>
                    <p className="text-sm text-foreground">{q.answer}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Textarea
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder="Type your answer..."
                      rows={2}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        if (answers[q.id]?.trim()) {
                          answerMutation.mutate({ id: q.id, answer: answers[q.id].trim() });
                          setAnswers({ ...answers, [q.id]: '' });
                        }
                      }}
                      disabled={!answers[q.id]?.trim() || answerMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
