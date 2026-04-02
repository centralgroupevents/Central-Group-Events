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
      "Every week. We cover the best events across North, Central, and South NJ.",
  },
  {
    question: "How do I submit my event?",
    answer: "Use the Submit Your Event form on our homepage.",
  },
  {
    question: "Is it free to subscribe?",
    answer: "Yes, completely free.",
  },
  {
    question: "How do I promote my event with CGE?",
    answer:
      "Fill out the Promote Your Event form and select Standard or Premium. Our team will be in touch within 24 hours.",
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
