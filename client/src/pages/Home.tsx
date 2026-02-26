import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight, Calendar, Megaphone, Video, MessageSquare, 
  Users, CheckCircle2, Ticket, MapPin, Loader2, Sparkles
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

import { useEvents, useSubscribeNewsletter, useCreateBooking } from "@/hooks/use-landing";
import { Navigation } from "@/components/Navigation";

// Re-defining schemas here for the form resolvers to match the API contract
const newsletterSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  region: z.string().min(1, "Region is required"),
});

const bookingSchema = z.object({
  venueName: z.string().min(2, "Venue Name is required"),
  contactName: z.string().min(2, "Contact Name is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email("Invalid email"),
  eventDate: z.string().min(1, "Date is required"),
  region: z.string().min(1, "Region is required"),
  eventType: z.string().min(1, "Event type is required"),
  budgetRange: z.string().min(1, "Budget range is required"),
  instagramHandle: z.string().optional(),
  readyToMoveForward: z.string().min(1, "Please select an option"),
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

  // Booking Form
  const bookingForm = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      venueName: "", contactName: "", phone: "", email: "", eventDate: "", 
      region: "", eventType: "", budgetRange: "", instagramHandle: "", readyToMoveForward: ""
    }
  });
  const bookingMutation = useCreateBooking();

  const onBookingSubmit = (data: z.infer<typeof bookingSchema>) => {
    bookingMutation.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Request Received! 🚀",
          description: "Our team will be in touch within 24 hours.",
        });
        bookingForm.reset();
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Submission failed",
          description: err.message || "Please try again later.",
        });
      }
    });
  };

  // Events Calendar
  const [activeRegion, setActiveRegion] = useState("All");
  const { data: events, isLoading: eventsLoading } = useEvents(activeRegion);

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
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-accent text-glow">
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
              { num: "15K+", label: "Newsletter Subscribers" },
              { num: "3x", label: "Average Attendance Increase" }
            ].map((stat, i) => (
              <motion.div key={i} variants={staggerItem} className="py-4 md:py-0 flex flex-col items-center justify-center">
                <h3 className="text-4xl md:text-5xl font-black text-white mb-2 font-display">{stat.num}</h3>
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
              { icon: MessageSquare, title: "Weekly Newsletter", desc: "15K+ subscribers get the weekend lineup every Thursday directly to their inbox." },
              { icon: Calendar, title: "Curated Event Calendar", desc: "Your event featured on our high-traffic NJ event hub visited by thousands." },
              { icon: Megaphone, title: "Paid Ads + Organic", desc: "We combine highly targeted Meta ads with grassroots community distribution." },
              { icon: Video, title: "Reel Production", desc: "Scroll-stopping, high-energy Instagram reels that drive real ticket sales." },
              { icon: Ticket, title: "SMS Blast Network", desc: "Direct text message campaigns to thousands of active NJ nightlife fans." },
              { icon: Users, title: "Influencer Collabs", desc: "We tap local NJ influencers and tastemakers who actually move crowds." }
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
                          <SelectItem value="All Regions">All Regions</SelectItem>
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
                >
                  {subscribeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Subscribe"}
                </Button>
              </form>
            </Form>
          </motion.div>
        </div>
      </section>

      {/* EVENT CALENDAR SECTION */}
      <section id="events" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeIn} className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <h2 className="text-sm font-bold text-accent tracking-widest uppercase mb-3">Event Calendar</h2>
              <h3 className="text-3xl md:text-5xl font-black">What's Happening in NJ</h3>
            </div>
            <Button variant="outline" className="rounded-full border-white/20 hover:bg-white/10" asChild>
              <a href="#book">Submit Your Event</a>
            </Button>
          </motion.div>

          <Tabs defaultValue="All" className="w-full" onValueChange={setActiveRegion}>
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl mb-8 flex w-full md:w-fit overflow-x-auto hide-scrollbar">
              {["All", "North NJ", "Central NJ", "South NJ"].map(region => (
                <TabsTrigger 
                  key={region} 
                  value={region}
                  className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white px-6 py-2.5"
                >
                  {region === "All" ? "All Regions" : region.replace(" NJ", "")}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeRegion} className="min-h-[400px]">
              {eventsLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : events && events.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {events.map((event) => (
                    <motion.div key={event.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card className="bg-secondary/50 border-white/10 overflow-hidden hover:border-primary/40 transition-all duration-300 group flex flex-col h-full">
                        <div className="relative h-48 overflow-hidden">
                          {/* event placeholder abstract lights */}
                          <img 
                            src={event.imageUrl || `https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop`} 
                            alt={event.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                          <div className="absolute bottom-3 left-3 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold border border-white/20 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {event.region}
                          </div>
                        </div>
                        <CardHeader className="flex-1 pb-2">
                          <CardTitle className="text-xl line-clamp-2 leading-tight">{event.title}</CardTitle>
                          <CardDescription className="text-primary font-medium mt-2">{event.date}</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 mt-auto">
                          <Button className="w-full rounded-xl bg-white/10 hover:bg-primary text-white border border-white/10 hover:border-primary transition-all duration-300" asChild>
                            <a href={event.ticketLink || "#"} target="_blank" rel="noopener noreferrer">
                              Get Tickets
                            </a>
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border-dashed">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  <h4 className="text-xl font-bold mb-2">No events found</h4>
                  <p className="text-muted-foreground max-w-md">There are currently no events listed for this region. Check back soon or submit your own event!</p>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {/* Starter */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Card className="bg-secondary/50 border-white/10 p-6 rounded-3xl">
                <h4 className="text-2xl font-bold mb-2">Starter</h4>
                <p className="text-muted-foreground mb-6 h-12">Perfect for testing the waters.</p>
                <div className="text-4xl font-black mb-6">$125<span className="text-lg text-muted-foreground font-normal"> / event</span></div>
                <ul className="space-y-4 mb-8 text-sm text-gray-300">
                  {['1 Instagram Reel', '1 Custom Event Flyer', 'Basic Meta Ad Campaign ($50 spend)', 'SMS Blast to 500 contacts', '1-Week Promotion Timeline'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white" asChild>
                  <a href="#book">Get Started</a>
                </Button>
              </Card>
            </motion.div>

            {/* Growth (Popular) */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
              <Card className="bg-gradient-to-b from-primary/20 to-secondary/80 border-primary/50 p-8 rounded-3xl relative transform md:-translate-y-4 shadow-2xl shadow-primary/20">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
                  Most Popular
                </div>
                <h4 className="text-2xl font-bold mb-2 text-white">Growth</h4>
                <p className="text-white/70 mb-6 h-12">For venues serious about selling out.</p>
                <div className="text-5xl font-black mb-6 text-white">$250<span className="text-lg text-white/50 font-normal"> / event</span></div>
                <ul className="space-y-4 mb-8 text-sm text-white/90">
                  {['2 Instagram Reels', '2 Custom Flyer Variations', 'Targeted Meta Ad Campaign ($100 spend)', 'Featured in Weekly Newsletter', 'Featured on Event Calendar', 'Influencer Story Reposts (3-5)', 'SMS Blast to 1,000 contacts', '2-Week Strategic Rollout'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full rounded-xl bg-white text-primary hover:bg-white/90 font-bold text-lg h-12" asChild>
                  <a href="#book">Get Started</a>
                </Button>
              </Card>
            </motion.div>

            {/* Full House */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
              <Card className="bg-secondary/50 border-white/10 p-6 rounded-3xl">
                <h4 className="text-2xl font-bold mb-2">Full House</h4>
                <p className="text-muted-foreground mb-6 h-12">Maximum distribution. Maximum turnout.</p>
                <div className="text-4xl font-black mb-6">$550<span className="text-lg text-muted-foreground font-normal"> / event</span></div>
                <ul className="space-y-4 mb-8 text-sm text-gray-300">
                  {['3 IG Reels + BTS Content', '3 Custom Flyer Variations', 'Full Meta Ad Campaign ($200 spend)', 'Premium Featured Newsletter Placement', 'Homepage Featured on Calendar', 'Influencer Reach (8-12 influencers)', 'SMS Blast to 2,500 contacts', '3-Week Strategic Rollout', 'Event Day Social Coverage'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white" asChild>
                  <a href="#book">Get Started</a>
                </Button>
              </Card>
            </motion.div>
          </div>
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

      {/* BOOKING FORM SECTION */}
      <section id="book" className="py-24 relative overflow-hidden">
        {/* nightlife abstract subtle background */}
        <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div {...fadeIn} className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Promote Your Event</h2>
            <p className="text-lg text-muted-foreground">We'll be in touch within 24 hours to get started.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-panel p-6 md:p-10 rounded-3xl border-white/10 shadow-2xl"
          >
            <Form {...bookingForm}>
              <form onSubmit={bookingForm.handleSubmit(onBookingSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={bookingForm.control} name="venueName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Venue Name *</FormLabel>
                      <FormControl><Input className="bg-black/40 border-white/10 h-12 rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={bookingForm.control} name="contactName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Contact Name *</FormLabel>
                      <FormControl><Input className="bg-black/40 border-white/10 h-12 rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={bookingForm.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Phone *</FormLabel>
                      <FormControl><Input type="tel" className="bg-black/40 border-white/10 h-12 rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={bookingForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Email *</FormLabel>
                      <FormControl><Input type="email" className="bg-black/40 border-white/10 h-12 rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={bookingForm.control} name="eventDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Event Date *</FormLabel>
                      <FormControl><Input type="date" className="bg-black/40 border-white/10 h-12 rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={bookingForm.control} name="region" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Region *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl"><SelectValue placeholder="Select region" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-secondary border-white/10 text-white">
                          <SelectItem value="North NJ">North NJ</SelectItem>
                          <SelectItem value="Central NJ">Central NJ</SelectItem>
                          <SelectItem value="South NJ">South NJ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={bookingForm.control} name="eventType" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Event Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-secondary border-white/10 text-white">
                          <SelectItem value="Grand Opening">Grand Opening</SelectItem>
                          <SelectItem value="Weekly Night">Weekly Night</SelectItem>
                          <SelectItem value="Holiday Event">Holiday Event</SelectItem>
                          <SelectItem value="Private Party">Private Party</SelectItem>
                          <SelectItem value="Album Release">Album Release</SelectItem>
                          <SelectItem value="Pop-Up Event">Pop-Up Event</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={bookingForm.control} name="budgetRange" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Budget Range *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl"><SelectValue placeholder="Select budget" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-secondary border-white/10 text-white">
                          <SelectItem value="$500 - $750">$500 - $750</SelectItem>
                          <SelectItem value="$750 - $1,200">$750 - $1,200</SelectItem>
                          <SelectItem value="$1,200+">$1,200+</SelectItem>
                          <SelectItem value="Not Sure Yet">Not Sure Yet</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                </div>

                <FormField control={bookingForm.control} name="instagramHandle" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80">Instagram Handle (Optional)</FormLabel>
                    <FormControl><Input placeholder="@yourvenue" className="bg-black/40 border-white/10 h-12 rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>

                <FormField control={bookingForm.control} name="readyToMoveForward" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80">Ready to move forward if aligned with budget? *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl"><SelectValue placeholder="Select one" /></SelectTrigger></FormControl>
                      <SelectContent className="bg-secondary border-white/10 text-white">
                        <SelectItem value="Yes — Let's go">Yes — Let's go</SelectItem>
                        <SelectItem value="Need More Info">Need More Info</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>

                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={bookingMutation.isPending}
                  className="w-full h-14 text-lg rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)] mt-4"
                >
                  {bookingMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : "Book Your Event Promotion"}
                </Button>
              </form>
            </Form>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-2xl tracking-tight text-white">
              CGE<span className="text-primary">.</span>
            </span>
          </div>
          <p className="text-muted-foreground text-sm text-center md:text-left">
            © {new Date().getFullYear()} Central Group Events. All rights reserved.
          </p>
          <div className="flex gap-4">
            <a href="https://www.instagram.com/centralgroupevents" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors">Instagram</a>
            <a href="#book" className="text-muted-foreground hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
