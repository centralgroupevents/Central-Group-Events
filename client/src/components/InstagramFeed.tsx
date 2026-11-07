import { Instagram } from "lucide-react";
import "./homepage-photos.css";

export function InstagramFeed() {
  return (
    /* INSTAGRAM FEED: replace placeholders with live feed once Replit Instagram connector is configured */
    <div
      className="cge-instagram-grid"
      data-testid="instagram-feed-grid"
      role="img"
      aria-label="Twelve Instagram photo placeholders"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div
          key={index}
          className="cge-instagram-placeholder"
          data-testid={`instagram-feed-placeholder-${index + 1}`}
          aria-hidden="true"
        >
          <Instagram aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
