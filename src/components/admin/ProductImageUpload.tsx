import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface ProductImageUploadProps {
  productId?: string;
  existingImages?: { id: string; image_url: string; order_index: number }[];
  onImagesChange: (images: File[]) => void;
  pendingImages: File[];
}

export function ProductImageUpload({ 
  productId, 
  existingImages = [], 
  onImagesChange,
  pendingImages 
}: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate files
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error(`${file.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });

    onImagesChange([...pendingImages, ...validFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePendingImage = (index: number) => {
    const newImages = pendingImages.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const deleteExistingImage = async (imageId: string, imageUrl: string) => {
    setDeletingId(imageId);
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/product-images/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('product-images').remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
      toast.success('Image deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete image');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Product Images</span>
      </div>

      {/* Existing Images */}
      {existingImages.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {existingImages.map((image) => (
            <div key={image.id} className="relative group aspect-square">
              <img
                src={image.image_url}
                alt="Product"
                className="w-full h-full object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={() => deleteExistingImage(image.id, image.image_url)}
                disabled={deletingId === image.id}
                className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {deletingId === image.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pending Images */}
      {pendingImages.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {pendingImages.map((file, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={URL.createObjectURL(file)}
                alt="Pending"
                className="w-full h-full object-cover rounded-lg border border-dashed border-primary"
              />
              <button
                type="button"
                onClick={() => removePendingImage(index)}
                className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-primary/80 text-primary-foreground text-xs rounded">
                New
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          Add Images
        </Button>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Max 5MB per image. Supports JPG, PNG, WebP
        </p>
      </div>
    </div>
  );
}

// Helper function to upload images
export async function uploadProductImages(productId: string, files: File[]): Promise<string[]> {
  const uploadedUrls: string[] = [];

  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    uploadedUrls.push(publicUrl);
  }

  return uploadedUrls;
}
