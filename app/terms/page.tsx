import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service | Smoothie",
  description: "Terms of Service for Smoothie - Your Blend positions, smoothly tracked",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Terms of Service</h1>
              <p className="text-xs text-muted-foreground">Last updated: December 15, 2024</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. What Smoothie Is</h2>
            <p className="text-muted-foreground leading-relaxed">
              Smoothie is a read-only portfolio viewer for the Blend Protocol on Stellar.
              We display publicly available blockchain data. We cannot execute transactions,
              access your private keys, or control your funds in any way.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. No Financial Advice</h2>
            <p className="text-muted-foreground leading-relaxed">
              Smoothie is for informational purposes only. Nothing on this site is financial,
              investment, or tax advice. Do your own research and consult professionals
              before making financial decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Data Accuracy</h2>
            <p className="text-muted-foreground leading-relaxed">
              While we strive for accuracy, we make no guarantees about the completeness or
              correctness of displayed data. Blockchain data may be delayed. Price data comes
              from third parties. Always verify important information independently.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Your Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for securing your own wallet and private keys.
              You are responsible for understanding the risks of DeFi and the Blend Protocol.
              You agree to comply with applicable laws in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Smoothie is provided &quot;as is&quot; without warranties. We are not liable for any
              losses related to your use of this service, including but not limited to
              losses from DeFi activities, liquidations, or decisions made based on
              information displayed here.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Changes</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these terms. Continued use after changes constitutes acceptance.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
