import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Star, Check, X, Trash2, Eye, EyeOff, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function AdminReviews() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<Record<string, string>>({});

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          products(name),
          profiles:user_id(name, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const approveReviewMutation = useMutation({
    mutationFn: async ({ id, is_approved }: { id: string; is_approved: boolean }) => {
      const { error } = await supabase
        .from('reviews')
        .update({ is_approved })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Review updated');
    },
    onError: () => toast.error('Failed to update review'),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Review deleted');
    },
    onError: () => toast.error('Failed to delete review'),
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const { error } = await supabase
        .from('reviews')
        .update({
          admin_response: response,
          admin_response_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Response posted');
    },
    onError: () => toast.error('Failed to post response'),
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
      />
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif">Reviews</h1>
        <div className="flex gap-2">
          <Badge variant="outline">
            {reviews?.filter(r => !r.is_approved).length || 0} Pending
          </Badge>
          <Badge variant="secondary">
            {reviews?.filter(r => r.is_approved).length || 0} Approved
          </Badge>
        </div>
      </div>

      {reviews?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No reviews yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews?.map((review) => (
            <Card key={review.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{review.title || 'No title'}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      on <span className="font-medium">{review.products?.name}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {review.is_verified && (
                      <Badge variant="default" className="bg-green-600">Verified Purchase</Badge>
                    )}
                    <Badge variant={review.is_approved ? 'secondary' : 'outline'}>
                      {review.is_approved ? 'Approved' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex">{renderStars(review.rating)}</div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(review.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                
                <p className="text-sm">{review.comment || 'No comment'}</p>

                {/* Review photo */}
                {review.image_url && (
                  <img
                    src={review.image_url}
                    alt="Review photo"
                    className="rounded-lg max-h-40 object-cover"
                  />
                )}

                {/* Admin response section */}
                {review.admin_response ? (
                  <div className="p-3 bg-primary/5 rounded-lg border-l-2 border-primary">
                    <p className="text-xs text-muted-foreground mb-1">Your response:</p>
                    <p className="text-sm text-foreground">{review.admin_response}</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Textarea
                      value={responses[review.id] || ''}
                      onChange={(e) => setResponses({ ...responses, [review.id]: e.target.value })}
                      placeholder="Write a public response..."
                      rows={2}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (responses[review.id]?.trim()) {
                          respondMutation.mutate({ id: review.id, response: responses[review.id].trim() });
                          setResponses({ ...responses, [review.id]: '' });
                        }
                      }}
                      disabled={!responses[review.id]?.trim() || respondMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    By: {(review.profiles as any)?.name || (review.profiles as any)?.email || 'Unknown'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => approveReviewMutation.mutate({ 
                        id: review.id, 
                        is_approved: !review.is_approved 
                      })}
                    >
                      {review.is_approved ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteReviewMutation.mutate(review.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
