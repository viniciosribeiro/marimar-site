"use client";

import { useState } from "react";

export function Gallery({ images }: { images: { url: string; alt: string }[] }) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Imagem principal */}
      <div className="relative aspect-[16/10] rounded-marca overflow-hidden bg-gray-100">
        <img
          src={images[selected]?.url}
          alt={images[selected]?.alt}
          className="w-full h-full object-cover"
        />
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === selected ? "bg-white scale-110" : "bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${
                i === selected ? "border-marca opacity-100" : "border-transparent opacity-60 hover:opacity-80"
              }`}
            >
              <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}