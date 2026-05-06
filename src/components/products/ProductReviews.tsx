import { useState, useEffect } from 'react';
import { Star, User, Check, Loader2, Camera } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  image_url: string | null;
  admin_response: string | null;
  admin_response_at: string | null;
  is_verified: boolean;
  created_at: string;
  profiles: {
    name: string | null;
  } | null;
}

interface ProductReviewsProps {
  productId: string;
  productName: string;
}

export function ProductReviews({ productId, productName }: ProductReviewsProps) {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewImage, setReviewImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newReview, setNewReview] = useState({
    rating: 5,
    title: '',
    comment: '',
  });

  useEffect(() => {
    fetchReviews();
    if (user) {
      checkCanReview();
    }
  }, [productId, user]);

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        title,
        comment,
        image_url,
        admin_response,
        admin_response_at,
        is_verified,
        created_at,
        profiles:user_id (name)
      `)
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (data) {
      setReviews(data as unknown as Review[]);
    }
    setLoading(false);
  };

  const checkCanReview = async () => {
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id,
        order_items!inner (
          product_variant_id,
          product_variants:product_variant_id (
            product_id
          )
        )
      `)
      .eq('status', 'delivered');

    if (orders) {
      const hasPurchased = orders.some(order =>
        order.order_items?.some((item: any) =>
          item.product_variants?.product_id === productId
        )
      );

      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('product_id', productId)
        .eq('user_id', user?.id)
        .single();

      setCanReview(hasPurchased && !existingReview);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setReviewImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please sign in to submit a review');
      return;
    }

    if (newReview.rating < 1 || newReview.rating > 5) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);

    let imageUrl: string | null = null;

    // Upload image if provided
    if (reviewImage) {
      const ext = reviewImage.name.split('.').pop();
      const path = `reviews/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, reviewImage);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase
      .from('reviews')
      .insert({
        product_id: productId,
        user_id: user.id,
        rating: newReview.rating,
        title: newReview.title || null,
        comment: newReview.comment || null,
        image_url: imageUrl,
        is_verified: true,
      });

    if (error) {
      toast.error('Failed to submit review');
    } else {
      toast.success('Review submitted! It will appear after approval.');
      setShowReviewForm(false);
      setNewReview({ rating: 5, title: '', comment: '' });
      setReviewImage(null);
      setImagePreview(null);
      setCanReview(false);
    }
    setSubmitting(false);
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const ratingCounts = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
    percentage: reviews.length > 0
      ? (reviews.filter(r => r.rating === rating).length / reviews.length) * 100
      : 0,
  }));

  if (!isEnabled('reviews')) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Rating Summary */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-foreground">
                  {averageRating.toFixed(1)}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-5 w-5 ${
                          star <= Math.round(averageRating)
                            ? 'fill-accent-foreground text-accent-foreground'
                            : 'text-muted-foreground'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Based on {reviews.length} reviews
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {ratingCounts.map(({ rating, count, percentage }) => (
                  <div key={rating} className="flex items-center gap-2">
                    <span className="text-sm w-12">{rating} stars</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-foreground rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Write Review */}
            <div>
              {canReview && !showReviewForm && (
                <div className="text-center p-6 border border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground mb-3">
                    You purchased this product. Share your experience!
                  </p>
                  <Button onClick={() => setShowReviewForm(true)}>
                    Write a Review
                  </Button>
                </div>
              )}

              {showReviewForm && (
                <div className="space-y-4 p-4 border border-border rounded-lg">
                  <div>
                    <Label>Your Rating</Label>
                    <div className="flex items-center gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewReview({ ...newReview, rating: star })}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-8 w-8 cursor-pointer transition-colors ${
                              star <= newReview.rating
                                ? 'fill-accent-foreground text-accent-foreground'
                                : 'text-muted-foreground hover:text-accent-foreground'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Title (optional)</Label>
                    <Input
                      value={newReview.title}
                      onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                      placeholder="Summarize your experience"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Review (optional)</Label>
                    <Textarea
                      value={newReview.comment}
                      onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                      placeholder="Tell others about your experience with this product"
                      className="mt-1"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label>Add a Photo (optional)</Label>
                    <div className="mt-1 flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2 border border-border rounded-md cursor-pointer hover:bg-muted transition-colors">
                        <Camera className="h-4 w-4" />
                        <span className="text-sm">Choose Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                      {imagePreview && (
                        <div className="relative">
                          <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-md" />
                          <button
                            onClick={() => { setReviewImage(null); setImagePreview(null); }}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSubmitReview} disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit Review'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowReviewForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!canReview && !showReviewForm && user && (
                <div className="text-center p-6 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Purchase and receive this product to leave a review
                  </p>
                </div>
              )}

              {!user && (
                <div className="text-center p-6 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Sign in to write a review
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {review.profiles?.name || 'Anonymous'}
                      </span>
                      {review.is_verified && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                          <Check className="h-3 w-3" />
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? 'fill-accent-foreground text-accent-foreground'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    {review.title && (
                      <h4 className="font-medium text-foreground mb-1">{review.title}</h4>
                    )}
                    {review.comment && (
                      <p className="text-muted-foreground">{review.comment}</p>
                    )}
                    {review.image_url && (
                      <img
                        src={review.image_url}
                        alt="Review photo"
                        className="mt-3 rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(review.image_url!, '_blank')}
                      />
                    )}
                    {/* Admin Response */}
                    {review.admin_response && (
                      <div className="mt-3 p-3 bg-primary/5 rounded-lg border-l-2 border-primary">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">Ihsan Team</Badge>
                          {review.admin_response_at && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.admin_response_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground">{review.admin_response}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No reviews yet. Be the first to review this product!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
