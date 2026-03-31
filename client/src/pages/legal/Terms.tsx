import { Navigation } from "@/components/Navigation";

const sections = [
  {
    heading: "1. Agreement to Terms",
    body: "By accessing or using the Central Group Events website and services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services. Central Group Events is a general partnership operating in New Jersey.",
  },
  {
    heading: "2. Please Read Before Proceeding",
    body: "Thank you for submitting your event to be featured on Central Group Events. By completing our submission form, you acknowledge that you have read, understood, and agree to the terms outlined below. Central Group Events reserves the right to accept or decline any submission at its sole discretion.",
  },
  {
    heading: "3. Services",
    body: 'Central Group Events ("CGE", "we", "us") provides event promotion services including but not limited to: social media promotion, newsletter distribution, SMS marketing campaigns, paid advertising management, content creation, and influencer coordination. Services are provided per event based on the package selected at time of booking.',
  },
  {
    heading: "4. Submission Deadlines",
    body: "All event promotion submissions are subject to a minimum 7-day lead time prior to the event date. Central Group Events operates on a weekly posting schedule, and available slots fill quickly. Submissions are accepted on a first-come, first-served basis. If your event coincides with a special occasion, holiday, or time-sensitive date, we strongly recommend submitting at least 2 weeks in advance and noting the time-sensitive nature in your submission. Late submissions may not be accommodated, and Central Group Events is not responsible for events that cannot be featured due to timing.",
  },
  {
    heading: "5. Inclusion Policy",
    body: "Central Group Events is a curated platform. A limited number of events may be featured in any given week, and submission does not guarantee inclusion. Factors that may affect inclusion include, but are not limited to: paid promotion slots being filled for the requested week, incomplete or missing submission information, unclear event concepts, insufficient contact details, or content determined by our staff to be unsafe, inappropriate, or inconsistent with our community standards.",
  },
  {
    heading: "6. Paid Promotions",
    body: "By selecting a paid promotion package, you agree to be contacted by Central Group Events via the email address provided to confirm your promotion details, schedule a posting date, and receive an invoice for payment. Promotion content will be created and scheduled following confirmation and payment. Central Group Events may, at its discretion, arrange to personally experience your event or service prior to promotion. All paid promotions are subject to availability.",
  },
  {
    heading: "7. Payments",
    body: "Payment is required to confirm your promotion package. We accept payment via Stripe and Cash App. All sales are final. Refunds are not provided once a promotion campaign has begun. If a campaign has not yet started, refund requests must be submitted within 48 hours of payment by emailing centralgroupevents@gmail.com.",
  },
  {
    heading: "8. Brand Partnerships",
    body: "This submission form is intended for individual promoters and community-level organizations. Large brands or organizations seeking broader partnership opportunities are encouraged to reach out directly via email at centralgroupevents@gmail.com for custom pricing and partnership inquiries. Submissions from large brands through this form may not be processed.",
  },
  {
    heading: "9. Client Responsibilities",
    body: "You agree to provide accurate event information including date, venue, type, and promotional materials. You grant CGE a non-exclusive license to use event flyers, images, and materials you submit for the purpose of promoting your event. You are responsible for ensuring your event complies with all applicable local, state, and federal laws.",
  },
  {
    heading: "10. Results Disclaimer",
    body: "CGE makes no guarantees regarding specific attendance numbers, ticket sales, or revenue outcomes. Promotion results vary based on event type, timing, market conditions, and other factors outside our control. Past performance of promoted events does not guarantee future results.",
  },
  {
    heading: "11. Intellectual Property",
    body: "All content created by CGE including graphics, copy, reels, and flyers remains the property of Central Group Events unless explicitly transferred in writing. You may not reproduce or distribute CGE-created content without written permission.",
  },
  {
    heading: "12. Limitation of Liability",
    body: "To the maximum extent permitted by law, Central Group Events and its partners shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our services, including lost revenue or event cancellations beyond our control.",
  },
  {
    heading: "13. Governing Law",
    body: "These Terms are governed by the laws of the State of New Jersey. Any disputes shall be resolved in the courts of New Jersey.",
  },
  {
    heading: "14. Changes to Terms",
    body: "We reserve the right to update these Terms at any time. Continued use of our services after changes constitutes acceptance of the updated Terms.",
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <h1 className="text-4xl font-black mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: March 31, 2026</p>

        <div className="space-y-10 text-white/80 leading-relaxed">
          {sections.map(({ heading, body }) => (
            <section key={heading}>
              <h2 className="text-xl font-bold text-white mb-3">{heading}</h2>
              <p>{body}</p>
            </section>
          ))}

          <section>
            <h2 className="text-xl font-bold text-white mb-3">15. Contact</h2>
            <p>
              For questions regarding your submission or these terms, please contact us at{" "}
              <a href="mailto:centralgroupevents@gmail.com" className="text-primary hover:underline">
                centralgroupevents@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
