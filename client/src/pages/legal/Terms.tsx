import { Navigation } from "@/components/Navigation";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <h1 className="text-4xl font-black mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: February 25, 2026</p>

        <div className="space-y-10 text-white/80 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Agreement to Terms</h2>
            <p>By accessing or using the Central Group Events website and services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services. Central Group Events is a general partnership operating in New Jersey.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Services</h2>
            <p>Central Group Events ("CGE", "we", "us") provides event promotion services including but not limited to: social media promotion, newsletter distribution, SMS marketing campaigns, paid advertising management, content creation, and influencer coordination. Services are provided per event based on the package selected at time of booking.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Payments</h2>
            <p>Payment is required to confirm your promotion package. We accept payment via Stripe and Cash App. All sales are final. Refunds are not provided once a promotion campaign has begun. If a campaign has not yet started, refund requests must be submitted within 48 hours of payment by emailing centralgroupevents@gmail.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Client Responsibilities</h2>
            <p>You agree to provide accurate event information including date, venue, type, and promotional materials. You grant CGE a non-exclusive license to use event flyers, images, and materials you submit for the purpose of promoting your event. You are responsible for ensuring your event complies with all applicable local, state, and federal laws.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Results Disclaimer</h2>
            <p>CGE makes no guarantees regarding specific attendance numbers, ticket sales, or revenue outcomes. Promotion results vary based on event type, timing, market conditions, and other factors outside our control. Past performance of promoted events does not guarantee future results.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Intellectual Property</h2>
            <p>All content created by CGE including graphics, copy, reels, and flyers remains the property of Central Group Events unless explicitly transferred in writing. You may not reproduce or distribute CGE-created content without written permission.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Central Group Events and its partners shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our services, including lost revenue or event cancellations beyond our control.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of New Jersey. Any disputes shall be resolved in the courts of New Jersey.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Changes to Terms</h2>
            <p>We reserve the right to update these Terms at any time. Continued use of our services after changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:centralgroupevents@gmail.com" className="text-primary hover:underline">centralgroupevents@gmail.com</a></p>
          </section>

        </div>
      </div>
    </div>
  );
}
