import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight, Calendar, Megaphone, Video, MessageSquare,
  Users, CheckCircle2, Ticket, MapPin, Loader2, Instagram, Search, Plus, X
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

import { useEvents, useSubscribeNewsletter, useCreateBooking } from "@/hooks/use-landing";
import { Navigation } from "@/components/Navigation";
import cgeLogo from "@assets/CGE_logo_1772075137138.png";

// Re-defining schemas here for the form resolvers to match the API contract
const newsletterSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  region: z.string().optional(),
});

const standardBookingSchema = z.object({
  mode: z.string(),
  eventName: z.string().min(1, "Event Name is required"),
  venueName: z.string().min(2, "Venue Name is required").max(100),
  email: z.string().email("Invalid email"),
  eventDate: z.string().min(1, "Event Date is required"),
  eventTime: z.string().min(1, "Event Time is required"),
  city: z.string().min(1, "City is required"),
  region: z.string().min(1, "Region is required"),
  eventType: z.string().min(1, "Event Type is required"),
  eventTypeOther: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  budgetRange: z.string().optional(),
  instagramHandle: z.string().max(50).optional(),
});

const premiumBookingSchema = standardBookingSchema.extend({
  contactName: z.string().min(2, "Contact Name is required"),
  phone: z.string().min(10, "Valid phone number required").max(20),
  budgetRange: z.string().min(1, "Budget Range is required"),
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
  const { toast } = useToast();
  
  // Newsletter Form
  const newsletterForm = useForm<z.infer<typeof newsletterSchema>>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { name: "", email: "", region: "" },
  });
  const subscribeMutation = useSubscribeNewsletter();
  
  const onNewsletterSubmit = (data: z.infer<typeof newsletterSchema>) => {
    subscribeMutation.mutate(data, {
      onSuccess: () => {
        toast({
          title: "You're plugged in! 🔌",
          description: "Check your inbox this Thursday for the weekend lineup.",
        });
        newsletterForm.reset();
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

  // Booking Mode Toggle
  const [bookingMode, setBookingMode] = useState<"Standard" | "Premium">("Standard");

  // Events Calendar
  const [activeRegion, setActiveRegion] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: events, isLoading: eventsLoading } = useEvents(activeRegion);

  const upcomingEvents = events || [];

  const filteredEvents = searchQuery.trim()
    ? upcomingEvents.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((e as any).city || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : upcomingEvents;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
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
            We've promoted 85+ events across NJ every week. Newsletter. Reels. Paid Ads. SMS Blasts. Influencers. All in one package.
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
              <a href="#book">
                Promote Your Event <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto h-14 px-8 text-lg rounded-2xl border-white/20 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              asChild
            >
              <a href="#newsletter">Join the Weekly Newsletter</a>
            </Button>
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
              { num: "85+", label: "Events Promoted Weekly" },
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
            
            <Form {...newsletterForm}>
              <form onSubmit={newsletterForm.handleSubmit(onNewsletterSubmit)} className="flex flex-col md:flex-row gap-4">
                <FormField
                  control={newsletterForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Your Name *" className="h-12 bg-black/50 border-white/10 focus-visible:ring-primary text-base rounded-xl" {...field} />
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
                        <Input placeholder="Email Address *" type="email" className="h-12 bg-black/50 border-white/10 focus-visible:ring-primary text-base rounded-xl" {...field} />
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
                          <SelectTrigger className="h-12 bg-black/50 border-white/10 focus:ring-primary text-base rounded-xl">
                            <SelectValue placeholder="Select Region *" />
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
                  size="lg"
                  className="h-12 px-8 rounded-xl bg-primary text-white hover:bg-primary/90 font-semibold md:w-auto w-full"
                  asChild
                >
                  <a href="https://www.centralgroupevents.com/" target="_blank" rel="noopener noreferrer">
                    Subscribe
                  </a>
                </Button>
              </form>
            </Form>
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

          {/* Search bar */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search events by name or city…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="input-event-search"
              className="w-full pl-11 pr-5 py-3.5 rounded-full bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
            />
          </div>

          {/* Centered region tabs */}
          <Tabs defaultValue="All" className="w-full" onValueChange={val => { setActiveRegion(val); setSearchQuery(""); }}>
            <div className="flex justify-center mb-8">
              <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl flex overflow-x-auto hide-scrollbar">
                {["All", "North NJ", "Central NJ", "South NJ"].map(region => (
                  <TabsTrigger
                    key={region}
                    value={region}
                    data-testid={`tab-region-${region.replace(/\s/g, "-").toLowerCase()}`}
                    className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white px-6 py-2.5"
                  >
                    {region === "All" ? "All Regions" : region.replace(" NJ", "")}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value={activeRegion} className="min-h-[400px]">
              {eventsLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : filteredEvents.length > 0 ? (
                <div className="divide-y divide-white/10 rounded-2xl border border-white/10 overflow-hidden">
                  {filteredEvents.map((event, idx) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      data-testid={`row-event-${event.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base leading-snug truncate" data-testid={`text-event-title-${event.id}`}>{event.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {(event as any).city ? `${(event as any).city}, ${event.region.replace(" NJ", "")} NJ` : event.region}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <p className="text-sm text-accent font-medium hidden sm:block">
                          {new Date(event.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-white/20 hover:bg-primary hover:border-primary hover:text-white transition-all duration-200"
                          asChild
                          data-testid={`button-tickets-${event.id}`}
                        >
                          <a href={event.ticketLink || "#"} target="_blank" rel="noopener noreferrer">
                            Get Tickets
                          </a>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border-dashed">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  <h4 className="text-xl font-bold mb-2">
                    {searchQuery ? "No events match your search" : "No upcoming events"}
                  </h4>
                  <p className="text-muted-foreground max-w-md">
                    {searchQuery
                      ? `Try a different name or city, or clear the search to see all events.`
                      : "No upcoming events in this region. Check back soon or submit your event!"}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
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
                      <th className="text-left px-6 py-6 w-[40%]">
                        <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Feature</span>
                      </th>
                      {/* Starter */}
                      <th className="px-4 py-6 text-center">
                        <div className="text-white font-black text-lg">Starter</div>
                        <div className="text-3xl font-black text-white mt-1">$70<span className="text-sm text-muted-foreground font-normal"> / event</span></div>
                      </th>
                      {/* Growth */}
                      <th className="px-4 py-6 text-center bg-primary/10 border-x border-primary/20">
                        <div className="inline-block bg-primary text-white text-[10px] font-bold tracking-widest uppercase px-3 py-0.5 rounded-full mb-2">Most Popular</div>
                        <div className="text-primary font-black text-lg">Growth</div>
                        <div className="text-3xl font-black text-white mt-1">$150<span className="text-sm text-white/50 font-normal"> / event</span></div>
                      </th>
                      {/* Custom */}
                      <th className="px-4 py-6 text-center">
                        <div className="text-white font-black text-lg">Custom</div>
                        <div className="text-3xl font-black text-white mt-1">$300+<span className="text-sm text-muted-foreground font-normal"> / event</span></div>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* Social Media Page Post */}
                    <tr className="border-b border-white/5">
                      <td className="px-6 py-4 text-sm text-white/80">Social Media Page Post <span className="text-muted-foreground text-xs">(IG / TT / FB)</span></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Story Post */}
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm text-white/80">Instagram &amp; FB Story Post</td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Email Blast */}
                    <tr className="border-b border-white/5">
                      <td className="px-6 py-4 text-sm text-white/80">Email Blast</td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Newsletter Placement */}
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm text-white/80">Newsletter Placement</td>
                      <td className="px-4 py-4 text-center"><span className="text-xs text-muted-foreground font-medium">Regular</span></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><span className="text-xs text-amber-400 font-semibold">Premium</span></td>
                      <td className="px-4 py-4 text-center"><span className="text-xs text-amber-400 font-semibold">Premium</span></td>
                    </tr>

                    {/* Event Calendar */}
                    <tr className="border-b border-white/5">
                      <td className="px-6 py-4 text-sm text-white/80">Event Calendar Feature</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* Ad Credit */}
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm text-white/80">Ad Credit</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><span className="text-sm font-bold text-white">$50</span></td>
                      <td className="px-4 py-4 text-center"><span className="text-sm font-bold text-white">$100</span></td>
                    </tr>

                    {/* Influencer Reach */}
                    <tr className="border-b border-white/5">
                      <td className="px-6 py-4 text-sm text-white/80">Influencer Reach</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>

                    {/* SMS Blast */}
                    <tr>
                      <td className="px-6 py-4 text-sm text-white/80">SMS Blast</td>
                      <td className="px-4 py-4 text-center"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center bg-primary/5 border-x border-primary/20"><X className="w-4 h-4 text-muted-foreground mx-auto" /></td>
                      <td className="px-4 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment buttons row */}
              <div className="border-t border-white/10 grid grid-cols-3 min-w-[600px]">
                {/* Starter button */}
                <div className="px-4 py-5 flex flex-col items-center gap-2">
                  <a
                    href="https://cash.app/$centralgroupevents"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl px-3 py-2.5 font-semibold text-xs text-black"
                    style={{ backgroundColor: "#00D632" }}
                    data-testid="button-cashapp-starter"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor">
                      <path d="M17.15 13.578c-.107.498-.46.914-.9 1.128-.22.106-.459.16-.698.16-.154 0-.308-.02-.457-.063l-2.496-.7v1.69c0 .434-.351.785-.784.785H9.815c-.433 0-.784-.351-.784-.785v-1.69l-2.496.7c-.15.043-.303.063-.457.063-.24 0-.478-.054-.699-.16-.44-.214-.792-.63-.9-1.128l-.26-1.21c-.158-.74.237-1.49.94-1.77l1.987-.78-1.987-.78c-.703-.28-1.098-1.03-.94-1.77l.26-1.21c.108-.498.46-.914.9-1.128.44-.214.947-.224 1.397-.026l2.255.994V4.688c0-.433.351-.784.784-.784h2.0c.433 0 .784.351.784.784v2.21l2.255-.994c.45-.198.957-.188 1.397.026.44.214.792.63.9 1.128l.26 1.21c.158.74-.237 1.49-.94 1.77l-1.987.78 1.987.78c.703.28 1.098 1.03.94 1.77l-.26 1.21z" />
                    </svg>
                    Pay with CashApp
                  </a>
                </div>

                {/* Growth button */}
                <div className="px-4 py-5 flex flex-col items-center gap-2 bg-primary/5 border-x border-primary/20">
                  <a
                    href="https://cash.app/$centralgroupevents"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl px-3 py-2.5 font-bold text-xs text-black"
                    style={{ backgroundColor: "#00D632" }}
                    data-testid="button-cashapp-growth"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor">
                      <path d="M17.15 13.578c-.107.498-.46.914-.9 1.128-.22.106-.459.16-.698.16-.154 0-.308-.02-.457-.063l-2.496-.7v1.69c0 .434-.351.785-.784.785H9.815c-.433 0-.784-.351-.784-.785v-1.69l-2.496.7c-.15.043-.303.063-.457.063-.24 0-.478-.054-.699-.16-.44-.214-.792-.63-.9-1.128l-.26-1.21c-.158-.74.237-1.49.94-1.77l1.987-.78-1.987-.78c-.703-.28-1.098-1.03-.94-1.77l.26-1.21c.108-.498.46-.914.9-1.128.44-.214.947-.224 1.397-.026l2.255.994V4.688c0-.433.351-.784.784-.784h2.0c.433 0 .784.351.784.784v2.21l2.255-.994c.45-.198.957-.188 1.397.026.44.214.792.63.9 1.128l.26 1.21c.158.74-.237 1.49-.94 1.77l-1.987.78 1.987.78c.703.28 1.098 1.03.94 1.77l-.26 1.21z" />
                    </svg>
                    Pay with CashApp
                  </a>
                </div>

                {/* Custom button */}
                <div className="px-4 py-5 flex flex-col items-center gap-2">
                  <Button
                    className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs h-9"
                    onClick={() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth" })}
                    data-testid="button-get-quote-custom"
                  >
                    Get a Quote
                  </Button>
                </div>
              </div>

              {/* Stripe coming soon */}
              <div className="py-4 text-center border-t border-white/5">
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

      {/* BOOKING FORM SECTION */}
      <section id="book" className="py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div {...fadeIn} className="text-center mb-8">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Promote Your Event</h2>
            <p className="text-lg text-muted-foreground">We'll be in touch within 24 hours to get started.</p>
          </motion.div>

          {/* Standard / Premium Toggle */}
          <motion.div {...fadeIn} className="flex justify-center mb-8">
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
              <button
                type="button"
                data-testid="toggle-standard"
                onClick={() => setBookingMode("Standard")}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  bookingMode === "Standard"
                    ? "bg-primary text-white shadow-lg"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                data-testid="toggle-premium"
                onClick={() => setBookingMode("Premium")}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  bookingMode === "Premium"
                    ? "bg-primary text-white shadow-lg"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                Premium
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-panel p-6 md:p-10 rounded-3xl border-white/10 shadow-2xl"
          >
            <BookingFormPanel key={bookingMode} mode={bookingMode} />
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
    </div>
  );
}

function BookingFormPanel({ mode }: { mode: "Standard" | "Premium" }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const bookingMutation = useCreateBooking();

  const activeSchema = mode === "Standard" ? standardBookingSchema : premiumBookingSchema;

  const bookingForm = useForm<z.infer<typeof premiumBookingSchema>>({
    resolver: zodResolver(activeSchema),
    defaultValues: {
      mode,
      eventName: "",
      venueName: "",
      contactName: "",
      phone: "",
      email: "",
      eventDate: "",
      eventTime: "",
      city: "",
      region: "",
      eventType: "",
      eventTypeOther: "",
      budgetRange: "",
      instagramHandle: "",
    },
  });

  const watchedEventType = bookingForm.watch("eventType");

  const onSubmit = (data: z.infer<typeof premiumBookingSchema>) => {
    bookingMutation.mutate({ ...data, mode }, {
      onSuccess: () => {
        navigate("/booking-confirmation");
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Submission failed",
          description: err.message || "Please try again later.",
        });
      },
    });
  };

  const inputClass = "bg-black/40 border-white/10 h-12 rounded-xl";
  const isPremium = mode === "Premium";

  return (
    <Form {...bookingForm}>
      <form onSubmit={bookingForm.handleSubmit(onSubmit)} className="space-y-6">

        {/* Event Name (full width) */}
        <FormField control={bookingForm.control} name="eventName" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-white/80">Event Name *</FormLabel>
            <FormControl><Input data-testid="input-event-name" className={inputClass} placeholder="e.g. Summer Rooftop Bash" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Venue Name + Contact Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={bookingForm.control} name="venueName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">Venue Name *</FormLabel>
              <FormControl><Input data-testid="input-venue-name" className={inputClass} placeholder="e.g. Club Luxe" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={bookingForm.control} name="contactName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">
                Contact Name {isPremium ? "*" : <span className="text-muted-foreground text-xs ml-1">(Optional)</span>}
              </FormLabel>
              <FormControl><Input data-testid="input-contact-name" className={inputClass} placeholder="Your full name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={bookingForm.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">Email *</FormLabel>
              <FormControl><Input data-testid="input-email" type="email" className={inputClass} placeholder="you@example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={bookingForm.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">
                Phone {isPremium ? "*" : <span className="text-muted-foreground text-xs ml-1">(Optional)</span>}
              </FormLabel>
              <FormControl><Input data-testid="input-phone" type="tel" className={inputClass} placeholder="(201) 555-0100" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Event Date + Event Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={bookingForm.control} name="eventDate" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">Event Date *</FormLabel>
              <FormControl><Input data-testid="input-event-date" type="date" className={inputClass} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={bookingForm.control} name="eventTime" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">Event Time *</FormLabel>
              <FormControl><Input data-testid="input-event-time" type="time" className={inputClass} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* City + Region */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={bookingForm.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">City *</FormLabel>
              <FormControl><Input data-testid="input-city" className={inputClass} placeholder="e.g. Newark" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={bookingForm.control} name="region" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">Region *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-region" className={inputClass}>
                    <SelectValue placeholder="Select region" />
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
          )} />
        </div>

        {/* Event Type */}
        <FormField control={bookingForm.control} name="eventType" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-white/80">Event Type *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-event-type" className={inputClass}>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-secondary border-white/10 text-white">
                <SelectItem value="Brunch">Brunch</SelectItem>
                <SelectItem value="Concert">Concert</SelectItem>
                <SelectItem value="Dance Class">Dance Class</SelectItem>
                <SelectItem value="DJ Set">DJ Set</SelectItem>
                <SelectItem value="Festival">Festival</SelectItem>
                <SelectItem value="Happy Hour">Happy Hour</SelectItem>
                <SelectItem value="Live Music">Live Music</SelectItem>
                <SelectItem value="Music">Music</SelectItem>
                <SelectItem value="Party">Party</SelectItem>
                <SelectItem value="Special Event">Special Event</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        {/* Other Event Type - conditional */}
        {watchedEventType === "Other" && (
          <FormField control={bookingForm.control} name="eventTypeOther" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">Please describe your event type</FormLabel>
              <FormControl>
                <Input
                  data-testid="input-event-type-other"
                  className={inputClass}
                  placeholder="Briefly describe your event type"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        {/* Budget Range */}
        <FormField control={bookingForm.control} name="budgetRange" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-white/80">
              Budget Range {isPremium ? "*" : <span className="text-muted-foreground text-xs ml-1">(Optional)</span>}
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-budget" className={inputClass}>
                  <SelectValue placeholder="Select budget" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-secondary border-white/10 text-white">
                <SelectItem value="Under $150">Under $150</SelectItem>
                <SelectItem value="$151 - $300">$151 - $300</SelectItem>
                <SelectItem value="$300 - $500">$300 - $500</SelectItem>
                <SelectItem value="$501+">$501+</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        {/* Instagram Handle */}
        <FormField control={bookingForm.control} name="instagramHandle" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-white/80">Instagram Handle <span className="text-muted-foreground text-xs ml-1">(Optional)</span></FormLabel>
            <FormControl>
              <Input
                data-testid="input-instagram"
                placeholder="@yourvenue"
                className={inputClass}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Upload Flyer */}
        <FormItem>
          <FormLabel className="text-white/80">Upload Event Flyer <span className="text-muted-foreground text-xs ml-1">(Optional)</span></FormLabel>
          <FormControl>
            <Input
              data-testid="input-flyer"
              type="file"
              accept="image/*"
              className="bg-black/40 border-white/10 h-12 rounded-xl text-white/80 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/20 file:text-primary file:font-medium hover:file:bg-primary/30 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) console.log("Flyer selected:", file.name);
              }}
            />
          </FormControl>
          <p className="text-xs text-muted-foreground mt-1">Upload from camera roll or take a photo</p>
        </FormItem>

        <Button
          type="submit"
          size="lg"
          data-testid="button-submit-booking"
          disabled={bookingMutation.isPending}
          className="w-full h-14 text-lg rounded-xl bg-primary hover:bg-primary/90 text-white font-bold mt-4"
        >
          {bookingMutation.isPending
            ? <Loader2 className="w-6 h-6 animate-spin" />
            : mode === "Standard"
              ? "Submit Standard Listing"
              : "Submit Premium Inquiry"
          }
        </Button>
      </form>
    </Form>
  );
}
