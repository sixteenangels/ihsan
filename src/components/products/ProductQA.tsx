import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

interface ProductQAProps {
  productId: string;
}

export function ProductQA({ productId }: ProductQAProps) {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['product-questions', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_questions')
        .select('*, profiles:user_id(name)')
        .eq('product_id', productId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const askMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('product_questions').insert({
        product_id: productId,
        user_id: user.id,
        question: question.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Question submitted! It will appear after admin review.');
      setQuestion('');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['product-questions', productId] });
    },
    onError: () => toast.error('Failed to submit question'),
  });

  if (!isEnabled('qa')) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Questions & Answers
          </CardTitle>
          {user && !showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              Ask a Question
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="p-4 border border-border rounded-lg space-y-3">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about this product..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => askMutation.mutate()}
                disabled={!question.trim() || askMutation.isPending}
              >
                {askMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Submit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : questions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No questions yet. Be the first to ask!
          </p>
        ) : (
          <div className="space-y-4">
            {questions.map((q: any) => (
              <div key={q.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {q.profiles?.name || 'Customer'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-foreground mt-1">{q.question}</p>
                  </div>
                </div>
                {q.answer && (
                  <div className="ml-11 p-3 bg-primary/5 rounded-lg border-l-2 border-primary">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">Ihsan Team</Badge>
                      {q.answered_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(q.answered_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{q.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
