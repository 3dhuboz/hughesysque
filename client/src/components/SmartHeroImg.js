import React, { useState, useEffect } from 'react';

/**
 * SmartHeroImg — always shows `fallback` immediately, then swaps in `src`
 * once the browser has fully loaded it. Works around slow-generating URLs
 * (e.g. Pollinations.ai) that would otherwise leave the hero completely black.
 */
const SmartHeroImg = ({ src, fallback, className, alt, style, onError, ...rest }) => {
  const effective = src && src.trim() ? src : fallback;
  const [displaySrc, setDisplaySrc] = useState(effective === fallback ? fallback : fallback);

  useEffect(() => {
    if (!src || src.trim() === '' || src === fallback) {
      setDisplaySrc(fallback);
      return;
    }
    setDisplaySrc(fallback);
    const img = new window.Image();
    img.onload = () => setDisplaySrc(src);
    img.onerror = () => setDisplaySrc(fallback);
    img.src = src;
  }, [src, fallback]);

  return (
    <img
      src={displaySrc}
      className={className}
      alt={alt}
      style={style}
      onError={() => setDisplaySrc(fallback)}
      {...rest}
    />
  );
};

export default SmartHeroImg;
