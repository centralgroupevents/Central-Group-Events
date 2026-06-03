import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Calendar, Megaphone, Video, MessageSquare,
  Users, CheckCircle2, Ticket, Loader2, Instagram, Plus, X
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";

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
import cgeLogo from "@assets/CGE_logo_1772075137138.png";

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
    subscribeMutation.mutate(data, {
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
        title="Central Group Events — NJ's #1 Event Hub"
        description="Discover the best events in New Jersey every week. North, Central, and South NJ nightlife, brunch spots, live music, R&B nights, and more. Submit or promote your event with CGE."
        keywords="events in NJ, things to do in New Jersey, NJ nightlife, New Jersey events this weekend, events near me NJ, Newark events, Jersey City events, North NJ events, Central NJ events, South NJ events, NJ brunch, NJ live music, NJ R&B night, event promotion New Jersey"
        canonical="https://www.centralgroupevents.com"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            "@id": "https://www.centralgroupevents.com/#organization",
            "name": "Central Group Events",
            "alternateName": "CGE",
            "url": "https://www.centralgroupevents.com",
            "logo": {
              "@type": "ImageObject",
              "url": "https://www.centralgroupevents.com/favicon.png",
            },
            "image": "https://www.centralgroupevents.com/og-image.jpg",
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
                  "url": "https://www.centralgroupevents.com/book?package=basic",
                },
                {
                  "@type": "Offer",
                  "name": "Starter",
                  "price": "70",
                  "priceCurrency": "USD",
                  "description":
                    "Event calendar listing, Instagram story feature, newsletter mention, and Facebook post",
                  "url": "https://www.centralgroupevents.com/book?package=starter",
                },
                {
                  "@type": "Offer",
                  "name": "Growth",
                  "price": "150",
                  "priceCurrency": "USD",
                  "description":
                    "Everything in Starter plus Instagram reel feature, premium newsletter placement, and SMS blast to subscribers",
                  "url": "https://www.centralgroupevents.com/book?package=growth",
                },
                {
                  "@type": "Offer",
                  "name": "Custom",
                  "price": "300",
                  "priceCurrency": "USD",
                  "description":
                    "Everything in Growth plus influencer reposts, strategy call, and custom campaign timeline",
                  "url": "https://www.centralgroupevents.com/book?package=custom",
                },
              ],
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": "https://www.centralgroupevents.com/#website",
            "url": "https://www.centralgroupevents.com",
            "name": "Central Group Events",
            "description": "NJ events discovery and event promotion",
            "publisher": { "@id": "https://www.centralgroupevents.com/#organization" },
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
            New Jersey's <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-yellow-400 to-amber-400 text-glow">
              Social Scene, Amplified.
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="mt-6 text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto font-light"
          >
            We've promoted 100+ events across NJ every week. Newsletter. Reels. Paid Ads. SMS Blasts. Influencers. All in one package.
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
                <li><a href="/world-cup-2026-nj-guide" className="text-muted-foreground hover:text-primary transition-colors">World Cup 2026 NJ Guide</a></li>
                <li><a href="/blog" className="text-muted-foreground hover:text-primary transition-colors">Weekly Newsletter</a></li>
                <li><a href="/faq" className="text-muted-foreground hover:text-primary transition-colors">FAQ</a></li>
              </ul>
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
        redirectAfter="/blog"
        onSuccess={() => setHeroSubscribed(true)}
      />
    </div>
  );
}
