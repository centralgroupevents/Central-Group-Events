import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "How do I get access to newsletter posts?",
    answer:
      "Just enter your email on any gated post. If you're already a subscriber, you're automatically on the list.",
  },
  {
    question: "How often is the newsletter published?",
    answer:
      "Every week. We cover the best events across North, Central, and South New Jersey.",
  },
  {
    question: "How do I submit my event?",
    answer: "Use the Book Promotion form on our homepage or visit /book to pick a package and submit your details.",
  },
  {
    question: "Is it free to subscribe?",
    answer: "Yes, completely free. You'll get our curated weekly NJ events list with no spam.",
  },
  {
    question: "What does NJ event promotion cost?",
    answer:
      "We offer four tiers: Basic (free calendar listing), Starter ($70 per event), Growth ($150 per event with reels, premium newsletter placement, and SMS blasts), and Custom ($300+ per event for influencer reposts and dedicated campaign timelines).",
  },
  {
    question: "How far in advance should I book event promotion?",
    answer:
      "Submit at least 7 days before your event date — we operate on a weekly posting schedule and slots fill quickly. For time-sensitive events (holidays, special weekends), 2 weeks in advance is recommended.",
  },
  {
    question: "Which New Jersey regions do you cover?",
    answer:
      "All of New Jersey — North NJ (Newark, Jersey City, Hoboken, Paterson, Elizabeth, Montclair), Central NJ (Trenton, New Brunswick, Edison, Plainfield), and South NJ (Atlantic City, Cherry Hill, Camden).",
  },
  {
    question: "What kinds of events do you promote?",
    answer:
      "Club nights, concerts, day parties, brunches, festivals, comedy shows, pop-ups, networking events, and lounge events. If it's a public, attendee-facing event in New Jersey, we can promote it.",
  },
  {
    question: "Do you do influencer promotion?",
    answer:
      "Yes — included in our Custom package. We have a network of NJ-based content creators who repost and feature events to their audiences.",
  },
  {
    question: "When does my event get posted after I book?",
    answer:
      "Our team confirms scheduling and invoicing within 24 hours of submission. Content goes live on your agreed posting date, typically the week of your event.",
  },
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="FAQ — Central Group Events"
        description="Frequently asked questions about Central Group Events. Learn how to submit your event, get promoted, and join the NJ event community."
        keywords="CGE FAQ, how to submit event NJ, event promotion New Jersey, Central Group Events"
        canonical="https://www.centralgroupevents.com/faq"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              "name": item.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer,
              },
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.centralgroupevents.com/" },
              { "@type": "ListItem", "position": 2, "name": "FAQ", "item": "https://www.centralgroupevents.com/faq" },
            ],
          },
        ]}
      />
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
