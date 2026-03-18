import { Navigation } from "@/components/Navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "What is Central Group Events (CGE)?",
    answer:
      "CGE is a NJ-based event promotion agency focused on nightlife, concerts, and community events across North, Central, and South Jersey. We curate and promote the best events so you never have to scroll endlessly looking for something to do.",
  },
  {
    question: "What areas of NJ do you cover?",
    answer:
      "We cover all three regions of New Jersey — North NJ (Newark, Jersey City, Fort Lee, Clifton, Garfield), Central NJ (Asbury Park, Edison, Plainfield, Somerville, East Brunswick), and South NJ (Atlantic City, Trenton, Cherry Hill, and more).",
  },
  {
    question: "How do I get my event listed?",
    answer:
      "Visit the Booking section on our homepage or reach out to us directly at centralgroupevents@gmail.com. We'll review your event details and get it added to the calendar if it's a good fit for our audience.",
  },
  {
    question: "What's included in the newsletter?",
    answer:
      "Subscribers receive a weekly roundup of the hottest upcoming events in NJ, exclusive early-bird announcements, and insider insights into the local nightlife scene. Some posts are subscriber-only — free to join.",
  },
  {
    question: "How does the subscriber access work for gated posts?",
    answer:
      "Certain blog posts are reserved for newsletter subscribers. Just enter your email, and if you're on the list you'll get instant access. If you're not yet subscribed, signing up takes only seconds.",
  },
  {
    question: "What are the pricing tiers for event promotion?",
    answer:
      "We offer three tiers: Starter (social posts + basic newsletter), Growth (flyers + featured calendar listing + newsletter spotlight), and Full House (everything in Growth plus social media takeovers and premium placement). Check our Pricing section for exact details.",
  },
  {
    question: "Can I book multiple events at once?",
    answer:
      "Absolutely. Many of our recurring event partners book us on a monthly or seasonal basis. Contact us for package deals on multiple events.",
  },
  {
    question: "What's the best way to reach you?",
    answer:
      "Email us at centralgroupevents@gmail.com or DM us on Instagram, TikTok, or Facebook @centralgroupevents. We typically respond within 24 hours.",
  },
  {
    question: "Do you work with events outside of NJ?",
    answer:
      "Our focus is on New Jersey, but we occasionally promote larger regional events that draw an NJ audience. Reach out and we'll let you know if your event qualifies.",
  },
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      {/* Header */}
      <section className="pt-28 pb-12 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-bold text-primary tracking-widest uppercase mb-3">Help Center</p>
          <h1 className="text-4xl md:text-6xl font-black mb-4">Frequently Asked Questions</h1>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about CGE and how we work.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 pb-24">
        <Accordion type="single" collapsible className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => (
            <AccordionItem
              key={idx}
              value={`item-${idx}`}
              className="glass-panel border border-white/10 rounded-xl px-4 overflow-hidden"
              data-testid={`accordion-faq-${idx}`}
            >
              <AccordionTrigger className="text-left font-semibold text-white hover:text-primary hover:no-underline py-5">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Contact CTA */}
        <div className="mt-16 glass-panel rounded-3xl p-8 text-center box-glow">
          <h3 className="text-xl font-black text-white mb-2">Still have questions?</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Our team is happy to help — reach out any time.
          </p>
          <a
            href="mailto:centralgroupevents@gmail.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
            data-testid="link-contact-faq"
          >
            Contact Us <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
