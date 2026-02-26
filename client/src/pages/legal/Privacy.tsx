import { Navigation } from "@/components/Navigation";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <h1 className="text-4xl font-black mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: February 25, 2026</p>

        <div className="space-y-10 text-white/80 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
            <p>When you submit a booking request or sign up for our newsletter, we collect: your name, email address, phone number, venue name, event details, Instagram handle (optional), and event flyer images (optional). We do not collect payment information directly — payments are processed by Stripe and Cash App under their respective privacy policies.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use the information you provide to: respond to booking inquiries, coordinate your event promotion campaign, send you the weekly CGE newsletter if subscribed, and improve our services. We do not sell, rent, or share your personal information with third parties for their marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Newsletter</h2>
            <p>If you subscribe to our newsletter, we will send you weekly event recommendations for your selected NJ region. You may unsubscribe at any time by clicking the unsubscribe link in any email or by contacting us at centralgroupevents@gmail.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Data Storage</h2>
            <p>Your information is stored securely on our platform. We retain booking inquiry data for up to 2 years for business record purposes. Newsletter subscriber data is retained until you unsubscribe.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Cookies</h2>
            <p>Our website may use basic cookies to maintain site functionality. We do not use tracking cookies for advertising purposes. You can disable cookies in your browser settings without affecting your ability to use our site.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Third Party Services</h2>
            <p>We use the following third party services which have their own privacy policies: Stripe (payment processing), Cash App (payment processing), Meta/Instagram (advertising and social media), TikTok (social media). We encourage you to review their privacy policies independently.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Your Rights</h2>
            <p>You have the right to request access to the personal information we hold about you, request correction of inaccurate information, or request deletion of your data. To exercise these rights, email us at centralgroupevents@gmail.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Children's Privacy</h2>
            <p>Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. Events promoted through CGE may have age restrictions set by the venue.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify subscribers of significant changes via email. Continued use of our services after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
            <p>For privacy questions or data requests, contact us at <a href="mailto:centralgroupevents@gmail.com" className="text-primary hover:underline">centralgroupevents@gmail.com</a></p>
          </section>

        </div>
      </div>
    </div>
  );
}
