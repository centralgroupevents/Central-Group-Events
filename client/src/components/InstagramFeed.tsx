import { useInstagramFeed } from "@/hooks/use-instagram-feed";
import { Button } from "@/components/ui/button";
import "./homepage-photos.css";

export function InstagramFeed() {
  const { data: posts = [], isPending, isError, refetch } = useInstagramFeed();

  if (isPending) {
    return (
      <div className="mt-10" role="status" aria-label="Loading Instagram photos" data-testid="instagram-feed-loading">
        <span className="sr-only">Loading Instagram photos</span>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="cge-instagram-skeleton aspect-square rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-6 text-sm text-muted-foreground" data-testid="instagram-feed-error" role="status">
        <p>Photos are temporarily unavailable. You can still find us on Instagram.</p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => void refetch()} data-testid="button-instagram-retry">
          Try again
        </Button>
      </div>
    );
  }

  // No connected account (or no eligible posts): retain the existing follow
  // button above, without implying that placeholder images are live posts.
  if (posts.length === 0) return <div hidden data-testid="instagram-feed-empty" />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 mt-10" data-testid="instagram-feed-grid">
      {posts.map((post, index) => (
        <a
          key={post.id}
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-square overflow-hidden rounded-xl border border-white/10 bg-secondary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          aria-label={`View @centralgroupevents Instagram post from ${new Date(post.timestamp).toLocaleDateString()} (opens in a new tab)`}
          data-testid={`instagram-feed-post-${index}`}
        >
          <img
            src={post.media_url}
            alt={`@centralgroupevents Instagram photo ${index + 1}`}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}
