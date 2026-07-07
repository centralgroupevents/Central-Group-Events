import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Calendar, Megaphone, Video, MessageSquare,
  Users, CheckCircle2, Ticket, Loader2, Instagram, Plus, X, BookOpen, Compass
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

import { useSubscribeNewsletter } from "@/hooks/use-landing";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { EventBrowser } from "@/components/EventBrowser";
import { EventsJsonLd } from "@/components/EventsJsonLd";
import { SubscribeModal } from "@/components/SubscribeModal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import cgeLogo from "@assets/CGE_logo_1772075137138.png";

// FAQ items for the homepage. Doubles as data for the FAQPage JSON-LD (rich
// snippets in Google) AND the visible accordion. Wording targets the most
// common search-query intents (regions, costs, event types, how to submit).
const HOMEPAGE_FAQS = [
  {
    q: "What is Central Group Events?",
    a: "Central Group Events (CGE) is New Jersey's #1 event discovery and promotion hub. We curate and promote 100+ events weekly across North, Central, and South NJ — covering brunches, day parties, concerts, festivals, watch parties, comedy, nightlife, and pop-ups. Visitors browse what's happening this weekend; venues and organizers book promotion packages to reach our audience.",
  },
  {
    q: "What kinds of events do you cover and promote in NJ?",
    a: "Brunches, day parties, club nights, concerts, festivals, comedy shows, watch parties, networking events, lounge events, and pop-ups. If it's a public, attendee-facing event happening in New Jersey, we can list it and (for paid packages) promote it to our weekly newsletter, Instagram audience, and SMS list.",
  },
  {
    q: "Which New Jersey regions do you cover?",
    a: "All of NJ — North NJ (Newark, Jersey City, Hoboken, Paterson, Elizabeth, Montclair, Bayonne), Central NJ (Trenton, New Brunswick, Edison, Plainfield, Princeton, East Brunswick), and South NJ (Atlantic City, Cherry Hill, Camden, Vineland, Ocean City). Filter the events list by region to see what's happening near you.",
  },
  {
    q: "How do I submit my event or book promotion?",
    a: "Pick a package on the Pricing section above and use the booking form, or visit /book directly. Packages range from a free calendar listing (Basic) through Starter ($70), Growth ($150 with reels + SMS blast), and Custom ($300+ with influencer reposts). Submit at least 7 days before your event so we have time to schedule slots.",
  },
  {
    q: "How much does event promotion in NJ cost?",
    a: "Four tiers: Basic (free calendar listing), Starter ($70 per event), Growth ($150 per event with Instagram reel, premium newsletter placement, and SMS blast), and Custom ($300+ per event with influencer reposts, strategy call, and dedicated campaign timeline). Detailed breakdown on the Pricing section above.",
  },
  {
    q: "How fast will my event get posted after I book?",
    a: "Our team confirms your booking + invoicing within 24 hours of submission. Content typically goes live the week of your event, on the agreed posting date. For best results, book at least 7 days out; for holiday weekends or peak-demand windows, 2 weeks ahead is recommended.",
  },
];

// Re-defining schemas here for the form resolvers to match the API contract
const newsletterSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  region: z.string().optional(),
});

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, ease: "easeOut" }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [heroSubscribed, setHeroSubscribed] = useState(false);
  // Powers the footer's auto-populated Guides column. Same query as the
  // ExploreNjSection strip — TanStack Query dedupes to a single request.
  const { data: footerGuides = [] } = useQuery<GuideLite[]>({
    queryKey: ["/api/landing-pages"],
    queryFn: async () => {
      const r = await fetch("/api/landing-pages");
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHeroSubscribed(localStorage.getItem("cge_newsletter_subscribed") === "true");
    }
  }, []);

  // Newsletter Form
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const newsletterForm = useForm<z.infer<typeof newsletterSchema>>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { name: "", email: "", region: "" },
  });
  const subscribeMutation = useSubscribeNewsletter();

  const onNewsletterSubmit = (data: z.infer<typeof newsletterSchema>) => {
    // Attribution at subscribe time — see SubscribeModal for the same pattern.
    const landingPath = typeof window !== "undefined" ? window.location.pathname : undefined;
    const referrer = typeof document !== "undefined" ? document.referrer || undefined : undefined;
    const utmSource = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("utm_source") || undefined
      : undefined;
    subscribeMutation.mutate({ ...data, referrer, landingPath, utmSource }, {
      onSuccess: () => {
        if (typeof window !== "undefined") {
          localStorage.setItem("cge_newsletter_subscribed", "true");
        }
        setNewsletterSubscribed(true);
        setHeroSubscribed(true);
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Oops!",
          description: err.message || "Failed to subscribe. Try again.",
        });
      }
    });
  };


  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <SEO
        title="Things to Do in NJ This Weekend — Curated Events Across NJ"
        description="Find the best things to do in NJ every weekend — concerts, day parties, brunches, festivals, watch parties, and nightlife. New events added weekly across North, Central, and South Jersey. Curated by Central Group Events."
        keywords="things to do in nj, things to do in new jersey this weekend, nj events this weekend, events near me nj, fun things to do in nj, nj nightlife, new jersey events, north nj events, central nj events, south nj events, nj brunch, nj live music, nj day parties, nj festivals, weekend events new jersey"
        canonical="https://centralgroupevents.com"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            "@id": "https://centralgroupevents.com/#organization",
            "name": "Central Group Events",
            "alternateName": "CGE",
            "url": "https://centralgroupevents.com",
            "logo": {
              "@type": "ImageObject",
              "url": "https://centralgroupevents.com/favicon.png",
            },
            "image": "https://centralgroupevents.com/og-image.jpg",
            "description":
              "New Jersey's #1 event discovery and promotion platform covering North, Central, and South NJ. We promote 100+ events weekly through newsletter, reels, paid ads, SMS blasts, and influencer campaigns.",
            "email": "centralgroupevents@gmail.com",
            "priceRange": "$70-$300+",
            "serviceType": "Event Promotion",
            "areaServed": [
              { "@type": "State", "name": "New Jersey" },
              { "@type": "City", "name": "Newark" },
              { "@type": "City", "name": "Jersey City" },
              { "@type": "City", "name": "Hoboken" },
              { "@type": "City", "name": "Paterson" },
              { "@type": "City", "name": "Elizabeth" },
              { "@type": "City", "name": "Trenton" },
              { "@type": "City", "name": "New Brunswick" },
              { "@type": "City", "name": "Atlantic City" },
              { "@type": "City", "name": "Cherry Hill" },
              { "@type": "City", "name": "Montclair" },
            ],
            "sameAs": [
              "https://www.instagram.com/centralgroupevents/",
              "https://www.tiktok.com/@centralgroupevents",
              "https://www.facebook.com/p/Central-Group-Events-61551661541206/",
            ],
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Event Promotion Packages",
              "itemListElement": [
                {
                  "@type": "Offer",
                  "name": "Basic",
                  "price": "0",
                  "priceCurrency": "USD",
                  "description": "Free event calendar listing",
                  "url": "https://centralgroupevents.com/book?package=basic",
                },
                {
                  "@type": "Offer",
                  "name": "Starter",
                  "price": "70",
                  "priceCurrency": "USD",
                  "description":
                    "Event calendar listing, Instagram story feature, newsletter mention, and Facebook post",
                  "url": "https://centralgroupevents.com/book?package=starter",
                },
                {
                  "@type": "Offer",
                  "name": "Growth",
                  "price": "150",
                  "priceCurrency": "USD",
                  "description":
                    "Everything in Starter plus Instagram reel feature, premium newsletter placement, and SMS blast to subscribers",
                  "url": "https://centralgroupevents.com/book?package=growth",
                },
                {
                  "@type": "Offer",
                  "name": "Custom",
                  "price": "300",
                  "priceCurrency": "USD",
                  "description":
                    "Everything in Growth plus influencer reposts, strategy call, and custom campaign timeline",
                  "url": "https://centralgroupevents.com/book?package=custom",
                },
              ],
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": "https://centralgroupevents.com/#website",
            "url": "https://centralgroupevents.com",
            "name": "Central Group Events",
            "description": "NJ events discovery and event promotion",
            "publisher": { "@id": "https://centralgroupevents.com/#organization" },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": HOMEPAGE_FAQS.map((f) => ({
              "@type": "Question",
              "name": f.q,
              "acceptedAnswer": { "@type": "Answer", "text": f.a },
            })),
          },
        ]}
      />
      <EventsJsonLd maxItems={10} />
      <Navigation />

      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] flex items-center pt-20 overflow-hidden">
        {/* Abstract dark glowing orbs in background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-accent/20 rounded-full blur-[150px] mix-blend-screen" />
        
        {/* nightlife concert crowd abstract */}
        <div className="absolute inset-0 bg-[url('https://pixabay.com/get/gd42b3a651fcd574e9734b3832e94b40d6f5a62c307da9126b767530ce7e17bbda530b6eed2703ebda06fd2e3f309efbf07d3080cfbf7a0e20e56506f8c8208f8_1280.jpg')] bg-cover bg-center opacity-[0.15] mix-blend-luminosity mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full text-center mt-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel mb-8 border-primary/30 text-primary-foreground/80 text-sm font-medium"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            North • Central • South NJ
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-[1.1]"
          >
            Things to Do in NJ <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-yellow-400 to-amber-400 text-glow">
              This Weekend.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="mt-6 text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto font-light"
          >
            The curated weekly events guide for New Jersey — concerts, day parties, brunches, festivals, watch parties, and nightlife across North, Central, and South Jersey. Updated every week.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button 
              size="lg" 
              className="w-full sm:w-auto h-14 px-8 text-lg rounded-2xl bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 transition-all duration-300 font-semibold"
              asChild
            >
              <a href="/book">
                Promote Your Event <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
            {heroSubscribed ? (
              <span
                className="w-full sm:w-auto h-14 px-8 text-base rounded-2xl border border-green-500/40 bg-green-500/10 text-green-400 font-semibold flex items-center justify-center"
                data-testid="text-hero-subscribe-success"
              >
                You're in! Check your inbox.
              </span>
            ) : (
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-2xl border-white/20 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                data-testid="button-hero-newsletter"
                onClick={() => {
                  if (heroSubscribed) {
                    navigate("/things-to-do-in-nj");
                    return;
                  }
                  document.getElementById("newsletter")?.scrollIntoView({ behavior: "smooth" });
                  setSubscribeModalOpen(true);
                }}
              >
                Join the Weekly Newsletter
              </Button>
            )}
          </motion.div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/10"
          >
            {[
              { num: "100+", label: "Events Promoted Weekly" },
              { num: "15+", label: "Events Curated In-House" },
              { num: "3x", label: "Average Attendance Increase" }
            ].map((stat, i) => (
              <motion.div key={i} variants={staggerItem} className="py-4 md:py-0 flex flex-col items-center justify-center">
                <h3 className="text-4xl md:text-5xl font-black text-accent mb-2 font-display">{stat.num}</h3>
                <p className="text-muted-foreground font-medium uppercase tracking-wider text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* WHAT WE DO SECTION */}
      <section id="services" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeIn} className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold text-primary tracking-widest uppercase mb-3">What We Do</h2>
            <h3 className="text-3xl md:text-5xl font-black mb-6">We're Not Just a Promo Agency. <br/><span className="text-muted-foreground">We're a Cultural Event Platform.</span></h3>
            <p className="text-lg text-muted-foreground">
              CGE is both a promotion agency and a media brand. We don't just post flyers — we distribute your event to an active, engaged NJ audience.
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              { icon: MessageSquare, title: "Weekly Newsletter", desc: "Hundreds of active NJ subscribers get the weekend event lineup every Thursday. Your event lands directly in their inbox — not lost in a feed algorithm." },
              { icon: Calendar, title: "Curated Event Calendar", desc: "Your event featured on our high-traffic NJ event hub visited by thousands." },
              { icon: Megaphone, title: "Paid Ads + Organic", desc: "We combine highly targeted Meta ads with grassroots community distribution." },
              { icon: Video, title: "Reel Production", desc: "Scroll-stopping, high-energy Instagram reels that drive real ticket sales." },
              { icon: Ticket, title: "SMS Blast Network", desc: "Direct SMS campaigns to opted-in NJ nightlife fans. Texts get opened. Posts get scrolled past." },
              { icon: Users, title: "Influencer Collabs", desc: "We tap in with local NJ influencers and tastemakers with real audiences — people who actually move crowds, not just collect followers." }
            ].map((service, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Card className="bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-primary/50 transition-all duration-300 h-full group overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] group-hover:bg-primary/20 transition-all duration-500" />
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <service.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{service.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{service.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* NEWSLETTER SECTION */}
      <section id="newsletter" className="py-24 bg-gradient-to-b from-transparent to-primary/5 relative border-y border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div {...fadeIn} className="glass-panel p-8 md:p-12 rounded-3xl box-glow text-center">
            <h2 className="text-3xl md:text-4xl font-black mb-4">The NJ Weekend Plug.</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Get the hottest events across North, Central, and South NJ delivered to your inbox every week. No spam. Just the best events.
            </p>

            {newsletterSubscribed ? (
              <div className="flex flex-col items-center gap-4 py-4" data-testid="newsletter-success">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
                <h3 className="text-2xl font-black text-white">You're subscribed! 🎉</h3>
                <p className="text-muted-foreground text-base max-w-sm">
                  Check your inbox (and spam folder) for a welcome email from us.
                </p>
              </div>
            ) : (
              <Form {...newsletterForm}>
                <form onSubmit={newsletterForm.handleSubmit(onNewsletterSubmit)} className="flex flex-col md:flex-row gap-4">
                  <FormField
                    control={newsletterForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            placeholder="Your Name *"
                            className="h-12 bg-black/50 border-white/10 focus-visible:ring-primary text-base rounded-xl"
                            data-testid="input-newsletter-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newsletterForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            placeholder="Email Address *"
                            type="email"
                            className="h-12 bg-black/50 border-white/10 focus-visible:ring-primary text-base rounded-xl"
                            data-testid="input-newsletter-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newsletterForm.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 bg-black/50 border-white/10 focus:ring-primary text-base rounded-xl" data-testid="select-newsletter-region">
                              <SelectValue placeholder="Region (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-secondary border-white/10 text-white">
                            <SelectItem value="North NJ">North NJ</SelectItem>
                            <SelectItem value="Central NJ">Central NJ</SelectItem>
                            <SelectItem value="South NJ">South NJ</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={subscribeMutation.isPending}
                    className="h-12 px-8 rounded-xl bg-primary text-white hover:bg-primary/90 font-semibold md:w-auto w-full"
                    data-testid="button-newsletter-subscribe"
                  >
                    {subscribeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Subscribe"
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </motion.div>
        </div>
      </section>

      {/* JUNETEENTH FEATURED BANNER — auto-hides after June 22 each year so
          the homepage doesn't carry a stale promo. Footer link stays year-round. */}
      {(() => {
        const today = new Date();
        const cutoff = new Date(today.getFullYear(), 5, 22); // June 22
        if (today > cutoff) return null;
        return (
          <section className="py-10">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <a
                href="/juneteenth-in-nj"
                className="block group rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-r from-red-700/30 via-black to-emerald-700/30 hover:border-white/30 transition-colors"
                data-testid="link-juneteenth-feature"
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-6 p-6 md:p-8">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest font-bold text-amber-300 mb-2">This Week · June 19</p>
                    <h3 className="text-2xl md:text-3xl font-black text-white mb-2">Juneteenth in NJ</h3>
                    <p className="text-sm md:text-base text-white/70 max-w-xl">
                      Cookouts, block parties, parades, and celebrations across New Jersey. The full curated list of where to celebrate Juneteenth in NJ.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-amber-300 font-semibold text-sm md:text-base group-hover:gap-3 transition-all">
                    See the list <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </a>
            </div>
          </section>
        );
      })()}

      {/* EVENT CALENDAR SECTION */}
      <section id="events" className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Centered header */}
          <motion.div {...fadeIn} className="text-center mb-10">
            <h2 className="text-sm font-bold text-accent tracking-widest uppercase mb-3">Event Calendar</h2>
            <h3 className="text-3xl md:text-5xl font-black mb-4">What's Happening in NJ</h3>
            <p className="text-muted-foreground mb-6">Discover the hottest events across North, Central, and South NJ.</p>
            <Button
              className="rounded-full bg-accent hover:bg-accent/90 text-black font-semibold px-6 gap-2"
              asChild
              data-testid="button-submit-event"
            >
              <a href="#book">
                <Plus className="w-4 h-4" /> Submit Your Event
              </a>
            </Button>
          </motion.div>

          <EventBrowser maxItems={10} showSeeMoreButton />
        </div>
      </section>

      {/* EXPLORE NJ SECTION — homepage discovery for landing pages + blog posts.
          Pulls from /api/landing-pages and /api/posts. Both strips are hidden
          when their source list is empty so a fresh install doesn't show
          empty sections. */}
      <ExploreNjSection />

      {/* PRICING SECTION */}
      <section id="pricing" className="py-24 bg-black/50 border-t border-white/5 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div {...fadeIn} className="text-center mb-16">
            <h2 className="text-sm font-bold text-primary tracking-widest uppercase mb-3">Pricing</h2>
            <h3 className="text-3xl md:text-5xl font-black">Pick Your Package</h3>
          </motion.div>

          {/* Comparison table */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="bg-secondary/40 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  {/* Column headers */}
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-6 py-6 w-[30%]">
                        <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Feature</span>
                      </th>
                      {/* Basic */}
                      <th className="px-4 pt-10 pb-6 text-center">
                        <div className="text-white font-black text-lg">Basic</div>
                        <div className="text-3xl font-black text-white mt-1">FREE</div>
                      </th>
                      {/* Starter */}
                      <th className="px-4 pt-10 pb-6 text-center">
                        <div className="text-white font-black text-lg">Starter</div>
                        <div className="text-3xl font-black text-white mt-1">$70<span className="text-sm text-muted-foreground font-normal"> / event</span></div>
                      </th>
                      {/* Growth */}
                      <th className="relative px-4 pt-10 pb-6 text-center bg-primary/10 border-x border-primary/20">
                        <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
                          <div className="inline-flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold tracking-widest uppercase px-3 py-0.5 shadow-lg">
                            Most Popular
                          </div>
                        </div>
                        <div className="text-primary font-black text-lg">Growth</div>
                        <div className="text-3xl font-black text-white mt-1">$150<span className="text-sm text-white/50 font-normal"> / event</span></div>
                      </th>
                      {/* Custom */}
                      <th className="px-4 pt-10 pb-6 text-center">
                        <div className="text-white font-black text-lg">Custom</div>
                        <div className="text-3xl font-black text-white mt-1">$300+<span className="text-sm text-muted-foreground font-normal"> / event</span></div>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* Event Calendar */}
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm text-white/80">Event Calendar</td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Social Media Post */}
                    <tr className="border-b border-white/5">
                      <td className="px-6 py-4 text-sm text-white/80">Social Media Post <span className="text-muted-foreground text-xs">(IG, FB, TT)</span></td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Stories */}
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm text-white/80">Stories <span className="text-muted-foreground text-xs">(Instagram, FB, TT)</span></td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Email Marketing */}
                    <tr className="border-b border-white/5">
                      <td className="px-6 py-4 text-sm text-white/80">Email Marketing</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* SMS Marketing */}
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm text-white/80">SMS Marketing</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Consultation */}
                    <tr className="border-b border-white/5">
                      <td className="px-6 py-4 text-sm text-white/80">Consultation</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Newsletter */}
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm text-white/80">Newsletter</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><span className="text-xs text-muted-foreground font-medium">Regular</span></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><span className="text-xs text-amber-400 font-semibold">Premium*</span></td>
                      <td className="px-4 py-4 text-center"><span className="text-xs text-amber-400 font-semibold">Premium*</span></td>
                    </tr>

                    {/* Influencer Reach */}
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm text-white/80">Influencer Reach</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Ad Credit */}
                    <tr>
                      <td className="px-6 py-4 text-sm text-white/80">Ad Credit</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><span className="text-sm font-bold text-white">$100</span></td>
                    </tr>
                  </tbody>

                  {/* Button row — lives inside the table so column widths match exactly */}
                  <tfoot>
                    <tr className="border-t border-white/10">
                      {/* Empty feature-label cell */}
                      <td className="px-6 py-5" />

                      {/* Basic */}
                      <td className="px-4 py-5 text-center">
                        <a
                          href="/book?package=basic"
                          className="inline-flex items-center justify-center w-full h-10 rounded-xl px-3 text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
                          data-testid="button-get-started-basic"
                        >
                          Get Started
                        </a>
                      </td>

                      {/* Starter */}
                      <td className="px-4 py-5 text-center">
                        <a
                          href="/book?package=starter"
                          className="inline-flex items-center justify-center w-full h-11 rounded-xl px-4 text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
                          data-testid="button-get-started-starter"
                        >
                          Get Started
                        </a>
                      </td>

                      {/* Growth */}
                      <td className="px-4 py-5 text-center bg-primary/5 border-x border-primary/20">
                        <a
                          href="/book?package=growth"
                          className="inline-flex items-center justify-center w-full h-12 rounded-xl px-5 text-base font-bold text-white bg-primary hover:bg-primary/90 transition-colors"
                          data-testid="button-get-started-growth"
                        >
                          Get Started
                        </a>
                      </td>

                      {/* Custom */}
                      <td className="px-4 py-5 text-center">
                        <a
                          href="/book?package=custom"
                          className="inline-flex items-center justify-center w-full h-12 rounded-xl px-6 text-base font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
                          data-testid="button-get-started-custom"
                        >
                          Get Started
                        </a>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Footnote + Stripe */}
              <div className="px-6 pt-3 pb-4 text-left space-y-1 border-t border-white/5">
                <p className="text-xs text-muted-foreground">* Premium Placement</p>
                <p className="text-xs text-muted-foreground">💳 Stripe payments coming soon</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PROCESS SECTION */}
      <section className="py-24 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeIn} className="text-center mb-16">
            <h2 className="text-sm font-bold text-accent tracking-widest uppercase mb-3">Process</h2>
            <h3 className="text-3xl md:text-5xl font-black">Four Steps to a Sold-Out Night</h3>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-1/8 right-1/8 h-0.5 bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 z-0" />
            
            {[
              { num: "01", title: "Submit Details", desc: "Fill out the booking form. Takes 3 minutes. Tell us your event, date, region, and budget." },
              { num: "02", title: "Strategy Call", desc: "We jump on a quick 15-minute call to align on your vision, goals, and promotion timeline." },
              { num: "03", title: "Promotion Rollout", desc: "We execute across newsletter, Instagram reels, Meta ads, SMS blasts, and influencer reposts — all timed strategically." },
              { num: "04", title: "Packed Event", desc: "Your venue fills up. Doors are packed. You focus on the experience — we handle the crowd." }
            ].map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative z-10 flex flex-col items-center text-center"
              >
                <div className="w-24 h-24 rounded-full bg-secondary border-4 border-background flex items-center justify-center text-3xl font-black text-primary mb-6 shadow-xl">
                  {step.num}
                </div>
                <h4 className="text-xl font-bold mb-3">{step.title}</h4>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL SECTION */}
      <section className="py-16 border-y border-white/5 bg-black/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeIn}>
            <h2 className="text-sm font-bold text-primary tracking-widest uppercase mb-3">Social</h2>
            <h3 className="text-3xl md:text-4xl font-black mb-4">Follow the Movement</h3>
            <p className="text-muted-foreground mb-8 text-lg">See what we're promoting this weekend</p>
            <a
              href="https://www.instagram.com/centralgroupevents/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg hover:opacity-90 transition-opacity"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              @centralgroupevents
            </a>
          </motion.div>
        </div>
      </section>

      {/* FAQ SECTION — adds substantive content for Bing/Google + FAQPage JSON-LD rich snippets */}
      <section id="faq" className="py-24 border-y border-white/5 bg-black/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeIn} className="text-center mb-12">
            <h2 className="text-sm font-bold text-primary tracking-widest uppercase mb-3">FAQ</h2>
            <h3 className="text-3xl md:text-4xl font-black mb-3">Frequently asked questions</h3>
            <p className="text-muted-foreground text-lg">Everything you need to know about CGE and promoting events in NJ.</p>
          </motion.div>
          <motion.div {...fadeIn}>
            <Accordion type="single" collapsible className="space-y-3">
              {HOMEPAGE_FAQS.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="bg-secondary/30 border border-white/10 rounded-2xl px-5 data-[state=open]:bg-secondary/40"
                  data-testid={`home-faq-${i}`}
                >
                  <AccordionTrigger className="text-left font-bold text-white hover:no-underline py-5">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/70 leading-relaxed pb-5">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="text-center text-sm text-muted-foreground mt-8">
              Have a different question? Email{" "}
              <a href="mailto:centralgroupevents@gmail.com" className="text-primary hover:underline">centralgroupevents@gmail.com</a>{" "}
              or visit our <a href="/faq" className="text-primary hover:underline">full FAQ</a>.
            </p>
          </motion.div>
        </div>
      </section>

      {/* BOOKING CTA SECTION */}
      <section id="book" className="py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div {...fadeIn}>
            <h2 className="text-3xl md:text-5xl font-black mb-4">Ready to promote your event?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join hundreds of NJ venues and promoters who trust CGE to fill their rooms.
            </p>
            <Button
              size="lg"
              className="h-14 px-10 text-lg rounded-2xl bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-105 transition-all duration-300 font-semibold"
              asChild
            >
              <a href="/book" data-testid="button-get-started">
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Popular pages — internal linking grid to topic landings.
              Strong topical-authority signal and helps Google/AI crawlers
              discover the programmatic city + type pages. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-10 border-b border-white/5">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-3">Popular cities</h3>
              <ul className="space-y-2 text-sm">
                {[
                  { slug: "things-to-do-in-newark", name: "Newark" },
                  { slug: "things-to-do-in-jersey-city", name: "Jersey City" },
                  { slug: "things-to-do-in-hoboken", name: "Hoboken" },
                  { slug: "things-to-do-in-trenton", name: "Trenton" },
                  { slug: "things-to-do-in-atlantic-city", name: "Atlantic City" },
                  { slug: "things-to-do-in-east-rutherford", name: "East Rutherford" },
                ].map((c) => (
                  <li key={c.slug}>
                    <a href={`/${c.slug}`} className="text-muted-foreground hover:text-primary transition-colors" data-testid={`footer-city-${c.slug}`}>
                      Things to do in {c.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-3">By event type</h3>
              <ul className="space-y-2 text-sm">
                {[
                  { slug: "brunches-in-nj", label: "Brunches in NJ" },
                  { slug: "day-parties-in-nj", label: "Day Parties in NJ" },
                  { slug: "concerts-in-nj", label: "Concerts in NJ" },
                  { slug: "comedy-shows-in-nj", label: "Comedy Shows in NJ" },
                  { slug: "nightlife-in-nj", label: "Nightlife in NJ" },
                  { slug: "live-music-in-nj", label: "Live Music in NJ" },
                ].map((t) => (
                  <li key={t.slug}>
                    <a href={`/${t.slug}`} className="text-muted-foreground hover:text-primary transition-colors" data-testid={`footer-type-${t.slug}`}>
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-3">This week</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/things-to-do-in-nj-this-weekend" className="text-muted-foreground hover:text-primary transition-colors">Things to do in NJ this weekend</a></li>
                <li><a href="/things-to-do-in-nj-tonight" className="text-muted-foreground hover:text-primary transition-colors">Things to do in NJ tonight</a></li>
                <li><a href="/free-things-to-do-in-nj" className="text-muted-foreground hover:text-primary transition-colors">Free things to do in NJ</a></li>
                <li><a href="/blog" className="text-muted-foreground hover:text-primary transition-colors">Weekly Newsletter</a></li>
                <li><a href="/faq" className="text-muted-foreground hover:text-primary transition-colors">FAQ</a></li>
              </ul>
              {/* Auto-populated NJ Guides column — pulls every published Page.
                  Publishing a new page in the CMS surfaces it here without a
                  code edit. Capped at 5 links so the footer doesn't balloon;
                  the /guides hub carries the full list. */}
              {footerGuides.length > 0 && (
                <>
                  <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 mt-6 mb-3">NJ Guides</h3>
                  <ul className="space-y-2 text-sm">
                    {footerGuides.slice(0, 5).map((g) => (
                      <li key={g.slug}>
                        <a href={`/${g.slug}`} className="text-muted-foreground hover:text-primary transition-colors" data-testid={`footer-guide-${g.slug}`}>
                          {g.title}
                        </a>
                      </li>
                    ))}
                    <li>
                      <a href="/guides" className="text-primary hover:underline font-semibold text-xs inline-flex items-center gap-1" data-testid="footer-see-all-guides">
                        See all guides →
                      </a>
                    </li>
                  </ul>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center">
              <img
                src={cgeLogo}
                alt="Central Group Events"
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="text-muted-foreground text-sm text-center md:text-left">
              © {new Date().getFullYear()} Central Group Events. All rights reserved.
            </p>
            <div className="flex gap-6 items-center">
              <a href="https://www.instagram.com/centralgroupevents/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.tiktok.com/@centralgroupevents" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z"/></svg>
              </a>
              <a href="https://www.facebook.com/p/Central-Group-Events-61551661541206/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="mailto:centralgroupevents@gmail.com" className="text-muted-foreground hover:text-white transition-colors text-sm">
                centralgroupevents@gmail.com
              </a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-center gap-6 text-xs text-muted-foreground">
            <a href="/legal/terms" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="/legal/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>

      <SubscribeModal
        open={subscribeModalOpen}
        onOpenChange={setSubscribeModalOpen}
        redirectAfter="/things-to-do-in-nj"
        onSuccess={() => setHeroSubscribed(true)}
      />
    </div>
  );
}

/* ─── ExploreNjSection ─────────────────────────────────────────────────────
   Homepage discovery block for landing pages (Guides) + blog posts. Both
   strips hide themselves when their source list is empty so the section
   doesn't render as empty on a fresh install. */

type GuideLite = {
  slug: string;
  title: string;
  metaDescription: string;
  heroImageUrl: string | null;
  ogImageUrl: string | null;
  updatedAt: string | null;
};

type BlogLite = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string | null;
};

function ExploreNjSection() {
  const { data: guides } = useQuery<GuideLite[]>({
    queryKey: ["/api/landing-pages"],
    queryFn: async () => {
      const r = await fetch("/api/landing-pages");
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
  });
  const { data: posts } = useQuery<BlogLite[]>({
    queryKey: ["/api/posts"],
    queryFn: async () => {
      const r = await fetch("/api/posts");
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
  });

  const featuredGuides = (guides || []).slice(0, 6);
  const recentPosts = (posts || []).slice(0, 4);
  if (featuredGuides.length === 0 && recentPosts.length === 0) return null;

  return (
    <section id="explore-nj" className="py-24 border-y border-white/5 bg-black/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* ── Guides strip ── */}
        {featuredGuides.length > 0 && (
          <div>
            <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-bold text-accent tracking-widest uppercase mb-3 flex items-center gap-2">
                  <Compass className="w-4 h-4" /> NJ Guides
                </h2>
                <h3 className="text-3xl md:text-4xl font-black">Deep-dive event guides</h3>
                <p className="text-muted-foreground mt-2 max-w-xl">
                  Curated NJ topic guides — evergreen resources for the biggest events, holidays, and neighborhoods.
                </p>
              </div>
              <Link href="/guides" className="text-primary hover:underline text-sm font-semibold inline-flex items-center gap-1" data-testid="link-see-all-guides">
                See all guides <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredGuides.map((g) => {
                const cover = g.ogImageUrl || g.heroImageUrl;
                return (
                  <a
                    key={g.slug}
                    href={`/${g.slug}`}
                    className="group block bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden transition-colors"
                    data-testid={`link-guide-${g.slug}`}
                  >
                    {cover ? (
                      <div className="aspect-[16/9] overflow-hidden bg-black/40">
                        <img
                          src={cover}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-[16/9] bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                        <Compass className="w-8 h-8 text-white/30" />
                      </div>
                    )}
                    <div className="p-5">
                      <h4 className="font-black text-lg text-white group-hover:text-primary transition-colors line-clamp-2">{g.title}</h4>
                      {g.metaDescription && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{g.metaDescription}</p>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Blog strip ── */}
        {recentPosts.length > 0 && (
          <div>
            <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-bold text-primary tracking-widest uppercase mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Weekly Newsletter
                </h2>
                <h3 className="text-3xl md:text-4xl font-black">Fresh from the blog</h3>
                <p className="text-muted-foreground mt-2 max-w-xl">
                  New every Thursday — the week's essential NJ event roundups, neighborhood spotlights, and behind-the-scenes.
                </p>
              </div>
              <a href="/blog" className="text-primary hover:underline text-sm font-semibold inline-flex items-center gap-1" data-testid="link-see-all-blog">
                See all posts <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {recentPosts.map((p) => (
                <a
                  key={p.id}
                  href={`/blog/${p.slug}`}
                  className="group block bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden transition-colors"
                  data-testid={`link-blog-${p.slug}`}
                >
                  {p.coverImageUrl ? (
                    <div className="aspect-[16/9] overflow-hidden bg-black/40">
                      <img
                        src={p.coverImageUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center">
                      <BookOpen className="w-7 h-7 text-white/30" />
                    </div>
                  )}
                  <div className="p-4">
                    <h4 className="font-bold text-base text-white group-hover:text-primary transition-colors line-clamp-2">{p.title}</h4>
                    {p.excerpt && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.excerpt}</p>
                    )}
                    {(p.publishedAt || p.createdAt) && (
                      <p className="text-[11px] text-white/40 mt-2">
                        {new Date(p.publishedAt || p.createdAt || "").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
