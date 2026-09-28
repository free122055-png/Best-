import React, { useState, useEffect, memo } from 'react';

export interface BannerSlideItem {
  id?: number | string;
  image?: string;
  tag?: string;
  title?: string;
  description?: string;
  bgGradient?: string;
}

interface MemoizedBannerSliderProps {
  slides: (string | BannerSlideItem)[];
  aspectRatioClass?: string;
  containerClass?: string;
  autoSlideInterval?: number;
  indicatorColor?: string;
}

export const MemoizedBannerSlider = memo(function MemoizedBannerSlider({
  slides,
  aspectRatioClass = "aspect-[21/9] sm:aspect-[24/9]",
  containerClass = "w-full overflow-hidden relative shadow-xs",
  autoSlideInterval = 4500,
  indicatorColor = "#00a884"
}: MemoizedBannerSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Normalize slide images
  const slideImages = React.useMemo(() => {
    if (!slides || slides.length === 0) return [];
    return slides.map(s => (typeof s === 'string' ? s : s.image || '')).filter(Boolean);
  }, [slides]);

  useEffect(() => {
    if (slideImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slideImages.length);
    }, autoSlideInterval);
    return () => clearInterval(timer);
  }, [slideImages.length, autoSlideInterval]);

  if (slideImages.length === 0) return null;

  return (
    <div className={`w-full select-none ${containerClass}`}>
      <div className={`w-full relative overflow-hidden ${aspectRatioClass}`}>
        <img
          src={slideImages[currentSlide]}
          alt="Banner"
          className="w-full h-full object-cover select-none transition-opacity duration-300"
          loading="lazy"
          decoding="async"
        />
        {slideImages.length > 1 && (
          <div className="absolute bottom-2.5 right-3.5 flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full backdrop-blur-xs">
            {slideImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Slide ${idx + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                  currentSlide === idx ? 'w-4' : 'w-1.5 bg-white/60 hover:bg-white'
                }`}
                style={{ backgroundColor: currentSlide === idx ? indicatorColor : undefined }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default MemoizedBannerSlider;
