import { CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function BookingConfirmation() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-4" data-testid="confirmation-heading">
          You're all set!
        </h1>
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="confirmation-message">
          Thank you. We will contact you shortly if we have any questions.
        </p>
        <Link href="/">
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-full px-8"
            data-testid="button-back-home"
          >
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
