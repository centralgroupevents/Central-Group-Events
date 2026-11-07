import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./homepage-photos.css";

// Original slots live here; the second sequence is only a looping duplicate.
const EVENT_PHOTOS = [
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "/images/homepage/event-01.svg",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "/images/homepage/event-02.svg",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "/images/homepage/event-03.svg",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "/images/homepage/event-04.svg",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "/images/homepage/event-05.svg",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "/images/homepage/event-06.svg",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "/images/homepage/event-07.svg",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "/images/homepage/event-08.svg",
];

export function HomepagePhotoStrip() {
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <section aria-label="CGE event photo strip" data-testid="homepage-photo-strip" className="pb-6">
      <div
        id="cge-photo-strip"
        className="cge-photo-strip"
        role="region"
        aria-label="Event photo placeholders. Animation pauses on hover or focus."
        tabIndex={0}
        data-paused={paused || !!reducedMotion}
      >
        <div className="cge-photo-track" data-testid="photo-strip-track">
          {[false, true].map(duplicate => (
            <div className="cge-photo-sequence" key={String(duplicate)} aria-hidden={duplicate || undefined}>
              {EVENT_PHOTOS.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  width={400}
                  height={500}
                  loading="lazy"
                  decoding="async"
                  alt={duplicate ? "" : `CGE event photo placeholder ${index + 1}`}
                  data-testid={duplicate ? undefined : `photo-strip-image-${index + 1}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-end mt-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground gap-2"
          onClick={() => setPaused(value => !value)}
          aria-controls="cge-photo-strip"
          aria-pressed={paused || !!reducedMotion}
          disabled={!!reducedMotion}
          data-testid="button-photo-strip-pause"
        >
          {paused || reducedMotion ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          {reducedMotion ? "Motion disabled" : paused ? "Resume photos" : "Pause photos"}
        </Button>
      </div>
    </section>
  );
}
