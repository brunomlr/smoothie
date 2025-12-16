import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy | Smoothie",
  description: "Privacy Policy for Smoothie - Your Blend positions, smoothly tracked",
};

export default function PrivacyPolicyPage() {
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
              <h1 className="text-lg font-semibold">Privacy Policy</h1>
              <p className="text-xs text-muted-foreground">Last updated: December 15, 2024</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. What Smoothie Does</h2>
            <p className="text-muted-foreground leading-relaxed">
              Smoothie is a read-only portfolio viewer for the Blend Protocol on the Stellar blockchain.
              We display publicly available blockchain data to help you track your DeFi positions.
              We cannot execute transactions or access your funds.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">Analytics</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We use analytics to understand how people use Smoothie. This may include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Pages visited</li>
              <li>Features used</li>
              <li>Device and browser information</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">What We Do NOT Collect</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Private keys or seed phrases</li>
              <li>Email addresses or personal identification</li>
              <li>Passwords</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Blockchain Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              We index publicly available data from the Stellar blockchain. This is public information
              that anyone can access. When you connect your wallet, we simply display this public data
              filtered to your address.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use third-party services for analytics and price data. Your use of Smoothie is also
              subject to the Stellar network and Blend Protocol.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Changes</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this policy. Changes will be reflected in the &quot;Last updated&quot; date above.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Questions? Reach out on <a href="https://github.com/brunomuler/smoothie" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
