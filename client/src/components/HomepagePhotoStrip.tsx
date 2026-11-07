import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./homepage-photos.css";

// Original slots live here; the second sequence is only a looping duplicate.
const EVENT_PHOTOS = [
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "event-01",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "event-02",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "event-03",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "event-04",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "event-05",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "event-06",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "event-07",
  /* REPLACE: upload real event photo to Cloudinary and swap src here */
  "event-08",
];

export function HomepagePhotoStrip() {
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <section aria-label="CGE event photo strip" data-testid="homepage-photo-strip" className="pb-6 cge-photo-section">
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
            <div
              className="cge-photo-sequence"
              key={String(duplicate)}
              aria-hidden={duplicate || undefined}
              data-testid={duplicate ? "photo-strip-duplicate" : "photo-strip-originals"}
            >
              {EVENT_PHOTOS.map((id, index) => (
                <div
                  key={id}
                  className="cge-photo-placeholder"
                  data-testid={duplicate ? undefined : `photo-strip-slot-${index + 1}`}
                >
                  CGE EVENT PHOTO
                </div>
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
