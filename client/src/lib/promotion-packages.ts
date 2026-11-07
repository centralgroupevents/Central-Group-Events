export const PACKAGES = [
  {
    id: "Basic",
    label: "Basic",
    price: "FREE",
    badge: null,
    features: ["Event calendar listing"],
    testId: "card-package-basic",
  },
  {
    id: "Starter",
    label: "Starter",
    price: "$70",
    badge: null,
    features: ["Event calendar listing", "Instagram story feature", "Newsletter mention", "Facebook post"],
    testId: "card-package-starter",
  },
  {
    id: "Growth",
    label: "Growth",
    price: "$150",
    badge: "Most Popular",
    features: ["Everything in Starter", "Instagram reel feature", "Premium newsletter placement", "SMS blast to subscribers"],
    testId: "card-package-growth",
  },
  {
    id: "Custom",
    label: "Custom",
    price: "$300+",
    badge: null,
    features: ["Everything in Growth", "Influencer reposts", "Strategy call included", "Custom campaign timeline"],
    testId: "card-package-custom",
  },
];

/** Expand inherited tiers so Payment shows every included feature explicitly. */
export function getIncludedPackageFeatures(id: string): string[] {
  const pkg = PACKAGES.find(item => item.id === id);
  return pkg?.features.flatMap(feature =>
    feature.startsWith("Everything in ")
      ? getIncludedPackageFeatures(feature.slice("Everything in ".length))
      : [feature],
  ) ?? [];
}
