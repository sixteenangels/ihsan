import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
}

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const displayImages = images.length > 0 ? images : ['https://via.placeholder.com/600'];

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPanPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      
      // Limit panning based on zoom level
      const maxPan = (zoomLevel - 1) * 200;
      setPanPosition({
        x: Math.max(-maxPan, Math.min(maxPan, newX)),
        y: Math.max(-maxPan, Math.min(maxPan, newY)),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 1 && e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { 
        x: e.touches[0].clientX - panPosition.x, 
        y: e.touches[0].clientY - panPosition.y 
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoomLevel > 1 && e.touches.length === 1) {
      const newX = e.touches[0].clientX - dragStart.current.x;
      const newY = e.touches[0].clientY - dragStart.current.y;
      
      const maxPan = (zoomLevel - 1) * 200;
      setPanPosition({
        x: Math.max(-maxPan, Math.min(maxPan, newX)),
        y: Math.max(-maxPan, Math.min(maxPan, newY)),
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-card border border-border group">
        <img
          src={displayImages[selectedIndex]}
          alt={`${productName} - Image ${selectedIndex + 1}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Zoom Button */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
          onClick={() => setIsZoomOpen(true)}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        {/* Navigation Arrows */}
        {displayImages.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
              onClick={goToPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
              onClick={goToNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Image Counter */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm text-sm font-medium text-foreground">
            {selectedIndex + 1} / {displayImages.length}
          </div>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {displayImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {displayImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={cn(
                'relative w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all',
                selectedIndex === idx
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <img
                src={img}
                alt={`${productName} thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom Dialog */}
      <Dialog open={isZoomOpen} onOpenChange={(open) => {
        setIsZoomOpen(open);
        if (!open) resetZoom();
      }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-background/95 backdrop-blur-md border-border">
          <div className="relative w-full h-[80vh]">
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="bg-background/80 backdrop-blur-sm"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="flex items-center px-3 bg-background/80 backdrop-blur-sm rounded-md text-sm font-medium">
                {Math.round(zoomLevel * 100)}%
              </div>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="bg-background/80 backdrop-blur-sm"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Navigation in Zoom View */}
            {displayImages.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm"
                  onClick={() => {
                    goToPrevious();
                    resetZoom();
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm"
                  onClick={() => {
                    goToNext();
                    resetZoom();
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* Zoomable Image */}
            <div
              ref={imageContainerRef}
              className={cn(
                'w-full h-full flex items-center justify-center overflow-hidden',
                zoomLevel > 1 ? 'cursor-grab' : 'cursor-zoom-in',
                isDragging && 'cursor-grabbing'
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={() => {
                if (zoomLevel === 1) {
                  handleZoomIn();
                }
              }}
            >
              <img
                src={displayImages[selectedIndex]}
                alt={`${productName} - Zoomed`}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                }}
                draggable={false}
              />
            </div>

            {/* Thumbnail Strip in Zoom View */}
            {displayImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg">
                {displayImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedIndex(idx);
                      resetZoom();
                    }}
                    className={cn(
                      'w-12 h-12 rounded overflow-hidden border-2 transition-all',
                      selectedIndex === idx
                        ? 'border-primary'
                        : 'border-transparent hover:border-primary/50'
                    )}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
