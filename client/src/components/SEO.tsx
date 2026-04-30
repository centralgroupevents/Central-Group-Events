import { Helmet } from "react-helmet-async";

const DEFAULT_IMAGE = "https://www.centralgroupevents.com/og-image.jpg";
const SITE_NAME = "Central Group Events";

interface SEOProps {
  title: string;
  description: string;
  canonical: string;
  keywords?: string;
  image?: string;
  type?: "website" | "article";
  publishedAt?: string | null;
  noindex?: boolean;
}

export function SEO({
  title,
  description,
  canonical,
  keywords = "",
  image,
  type = "website",
  publishedAt,
  noindex = false,
}: SEOProps) {
  const ogImage = image || DEFAULT_IMAGE;
  const fullTitle = `${title} | ${SITE_NAME}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Article-specific */}
      {type === "article" && publishedAt && (
        <meta property="article:published_time" content={publishedAt} />
      )}
      {type === "article" && (
        <meta property="article:author" content={SITE_NAME} />
      )}
    </Helmet>
  );
}
