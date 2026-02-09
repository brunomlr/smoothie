import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Shield, TrendingUp, Wallet, Coins, Info, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Blend 101 - Learn About Blend Protocol",
  description: "Learn the fundamentals of lending, borrowing, and earning on Stellar's Blend Protocol",
};

export default function Blend101Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Blend 101</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-4 py-8">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Welcome to Blend 101
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Learn the fundamentals of lending, borrowing, and earning on Stellar&apos;s Blend Protocol
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            <Badge variant="secondary" className="text-sm">Decentralized Lending</Badge>
            <Badge variant="secondary" className="text-sm">Built on Stellar</Badge>
            <Badge variant="secondary" className="text-sm">Earn Passive Income</Badge>
          </div>
        </section>

        {/* Quick Start Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">What is Blend?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A decentralized lending protocol on Stellar
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Getting Started</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Connect your wallet and start earning
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Safety & Risks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Understand security and risk management
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Backstops</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Insurance pools for advanced users
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Main Content */}
        <section className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">Learn the Fundamentals</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {/* What is Blend */}
              <AccordionItem value="what-is-blend" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-semibold">What is Blend Protocol?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-muted-foreground pt-4">
                  <p>
                    Blend Protocol is a <strong>decentralized lending and borrowing protocol</strong> built on the Stellar network.
                    It connects lenders (suppliers) with borrowers in an open, permissionless marketplace.
                  </p>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">How it Works:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Users <strong>supply assets</strong> to pools to earn interest</li>
                      <li>Borrowers can <strong>take loans</strong> by providing collateral</li>
                      <li>Interest rates are determined <strong>algorithmically</strong> based on supply and demand</li>
                      <li>All transactions happen <strong>on-chain</strong> with no intermediaries</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Key Benefits:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li><strong>Earn passive yield</strong> on idle assets</li>
                      <li><strong>Access liquidity</strong> without selling your holdings</li>
                      <li><strong>Transparent</strong> on-chain lending</li>
                      <li><strong>Fast & low-cost</strong> transactions on Stellar</li>
                    </ul>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong>Example:</strong> Supply 1,000 USDC at 5% APY → Earn ~50 USDC per year in interest
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Supply & Lending */}
              <AccordionItem value="supply-lending" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Supply & Lending</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-muted-foreground pt-4">
                  <p>
                    <strong>Supplying assets</strong> means depositing tokens (like USDC, XLM, etc.) into a pool where they can be borrowed by others.
                    In return, you earn interest on your deposit.
                  </p>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Key Concepts:</h4>
                    <ul className="space-y-3">
                      <li>
                        <strong className="text-foreground">Supply APY:</strong> The annual interest rate you earn as a lender
                      </li>
                      <li>
                        <strong className="text-foreground">Collateral vs Non-Collateral:</strong>
                        <ul className="ml-6 mt-2 space-y-1 list-disc list-inside">
                          <li><strong>Collateral:</strong> Locked to back borrowing, earns interest</li>
                          <li><strong>Non-Collateral:</strong> Can be withdrawn anytime, still earns interest</li>
                        </ul>
                      </li>
                      <li>
                        <strong className="text-foreground">How Interest Works:</strong> Earned through bTokens that automatically increase in value over time
                      </li>
                    </ul>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong>Tip:</strong> Start by supplying stable assets (like USDC) to a low-risk pool.
                      Mark as non-collateral initially to keep maximum flexibility.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Borrowing */}
              <AccordionItem value="borrowing" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Borrowing</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-muted-foreground pt-4">
                  <p>
                    <strong>Borrowing</strong> allows you to take loans against your collateral.
                    This is useful when you want liquidity but don&apos;t want to sell your assets.
                  </p>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Important Concepts:</h4>
                    <ul className="space-y-3">
                      <li>
                        <strong className="text-foreground">Collateral Factor (CF):</strong> The percentage of your collateral value you can borrow
                        <p className="text-sm mt-1">Example: 75% CF means you can borrow up to $750 per $1,000 of collateral</p>
                      </li>
                      <li>
                        <strong className="text-foreground">Borrow APY:</strong> Interest rate you pay on borrowed funds
                      </li>
                      <li>
                        <strong className="text-foreground">Borrow Limit:</strong> Maximum amount you can borrow based on your collateral
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Health Monitoring:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                        <span className="text-sm"><strong>0-50%:</strong> Safe</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                        <span className="text-sm"><strong>50-80%:</strong> Moderate risk</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500"></div>
                        <span className="text-sm"><strong>80%+:</strong> High risk, near liquidation</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong>Example:</strong> Deposit $1,000 XLM as collateral → Borrow $600 USDC at 8% APY → Pay ~$48 interest per year
                    </p>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong>Safety Tip:</strong> Keep your borrow limit below 50% to maintain a healthy safety margin.
                      Never exceed 80% unless you actively monitor your position.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Liquidations & Risk */}
              <AccordionItem value="liquidations" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Liquidations & Risk Management</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-muted-foreground pt-4">
                  <p>
                    <strong>Liquidation</strong> occurs when your collateral value drops and can no longer adequately cover your loan.
                    Understanding and managing this risk is crucial.
                  </p>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Key Terms:</h4>
                    <ul className="space-y-3">
                      <li>
                        <strong className="text-foreground">Liability Factor:</strong> The threshold that triggers liquidation (e.g., 80%)
                      </li>
                      <li>
                        <strong className="text-foreground">Partial Liquidations:</strong> The system sells just enough collateral to restore health
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">How to Stay Safe:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Maintain borrow limit below 50%</li>
                      <li>Monitor collateral prices regularly</li>
                      <li>Add more collateral or repay debt if approaching limits</li>
                      <li>Set up price alerts for your collateral assets</li>
                      <li>Keep a buffer - don&apos;t borrow the maximum amount</li>
                      <li>Diversify collateral across multiple assets</li>
                    </ul>
                  </div>

                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong>Warning:</strong> Liquidations can result in loss of collateral.
                      Always monitor your positions and maintain a healthy safety margin.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Backstops */}
              <AccordionItem value="backstops" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-semibold">What are Backstops?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-muted-foreground pt-4">
                  <p>
                    <strong>Backstops</strong> are insurance pools that protect lenders against defaults.
                    Backstop participants provide liquidity and earn rewards in return.
                  </p>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">How Backstops Work:</h4>
                    <ul className="space-y-3">
                      <li>
                        <strong className="text-foreground">Purpose:</strong> Safeguard the protocol by providing a safety net for lending pools
                      </li>
                      <li>
                        <strong className="text-foreground">What You Deposit:</strong> A mix of BLND (80%) and USDC (20%) tokens
                      </li>
                      <li>
                        <strong className="text-foreground">What You Receive:</strong> LP (Liquidity Provider) tokens representing your share
                      </li>
                      <li>
                        <strong className="text-foreground">How You Earn:</strong>
                        <ul className="ml-6 mt-2 space-y-1 list-disc list-inside">
                          <li><strong>Interest APR:</strong> Share of borrowers&apos; interest payments</li>
                          <li><strong>BLND Emissions:</strong> Protocol rewards for providing backstop liquidity</li>
                        </ul>
                      </li>
                      <li>
                        <strong className="text-foreground">Risk:</strong> In case of pool defaults, backstop can be used to cover losses
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Queue for Withdrawal (Q4W):</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>When you want to exit, you &quot;queue&quot; your LP tokens</li>
                      <li><strong>21-day lock period</strong> before you can claim your funds</li>
                      <li>Protects the pool from sudden liquidity exits</li>
                      <li>You can have multiple Q4W chunks with different unlock dates</li>
                    </ul>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong>Example:</strong> Deposit $1,000 (80% BLND + 20% USDC) → Receive LP tokens →
                      Earn 15% APY (10% emissions + 5% interest)
                    </p>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong>Who Should Use Backstops:</strong> Advanced users comfortable with protocol risk,
                      long-term believers in Blend, or those seeking higher yields with additional risk.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* BLND Token & Emissions */}
              <AccordionItem value="blnd-emissions" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="font-semibold">BLND Token & Emissions</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-muted-foreground pt-4">
                  <p>
                    <strong>BLND</strong> is the governance and rewards token of Blend Protocol,
                    used to incentivize participation across the ecosystem.
                  </p>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">How to Earn BLND:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li><strong>Supply Emissions:</strong> Earn BLND for lending assets</li>
                      <li><strong>Borrow Emissions:</strong> Earn BLND for borrowing (reduces effective borrow cost)</li>
                      <li><strong>Backstop Emissions:</strong> Earn BLND for providing backstop liquidity</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Managing Your BLND:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>View claimable BLND on your dashboard</li>
                      <li>Claim rewards at any time</li>
                      <li>Option to deposit claimed BLND into backstop pools</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">What to Do with BLND:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Hold for protocol governance rights</li>
                      <li>Add to backstop pools for additional yield</li>
                      <li>Sell on DEXs for other assets</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Getting Started */}
              <AccordionItem value="getting-started" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="font-semibold">How to Get Started</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 text-muted-foreground pt-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Step 1: Connect Your Wallet</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Supported wallets: Freighter, Lobstr, and other Stellar wallets</li>
                      <li>Install wallet extension/app if you don&apos;t have one</li>
                      <li>Connect to Smoothie dashboard</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Step 2: Explore Pools</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Navigate to the &quot;Explore&quot; page</li>
                      <li>Review different pools (USDC, XLM, BTC, etc.)</li>
                      <li>Check Supply APY, Borrow APY, and utilization rates</li>
                      <li>Compare pools based on your goals</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Step 3: Start with Supplying</h4>
                    <p className="text-sm">For beginners:</p>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Start by supplying stable assets (USDC) to a low-risk pool</li>
                      <li>Mark as non-collateral initially to keep flexibility</li>
                      <li>Watch your balance grow over time</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Step 4: Try Borrowing (Optional)</h4>
                    <p className="text-sm">When you&apos;re ready:</p>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Supply collateral to a pool</li>
                      <li>Mark assets as collateral</li>
                      <li>Borrow a small amount (20-30% of limit)</li>
                      <li>Monitor your health indicator regularly</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Step 5: Explore Advanced Features</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Join backstop pools for higher yields</li>
                      <li>Claim and stake BLND emissions</li>
                      <li>Track your performance over time</li>
                      <li>Use the pool simulator to test scenarios</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Safety */}
              <AccordionItem value="safety" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Is Blend Safe?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-muted-foreground pt-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Security Measures:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li><strong>Smart Contract Audits:</strong> Code has been audited by security firms</li>
                      <li><strong>Open Source:</strong> All code is publicly verifiable</li>
                      <li><strong>Battle-Tested:</strong> Built on Stellar&apos;s proven blockchain</li>
                      <li><strong>Insurance:</strong> Backstops provide an additional security layer</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Protocol Risks:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Smart contract bugs (though audited)</li>
                      <li>Oracle failures affecting price feeds</li>
                      <li>Extreme market volatility</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">User Risks:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Liquidation from insufficient collateral</li>
                      <li>Impermanent loss in backstop pools</li>
                      <li>Asset price volatility</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Best Practices:</h4>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>Start small and learn the platform</li>
                      <li>Never invest more than you can afford to lose</li>
                      <li>Keep borrow limit below 50% for safety margin</li>
                      <li>Regularly monitor your positions</li>
                      <li>Enable wallet notifications for important events</li>
                      <li>Understand each action before confirming transactions</li>
                    </ul>
                  </div>

                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong>Important:</strong> DeFi involves risk. Always do your own research and never invest funds you cannot afford to lose.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Glossary */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Key Terminology</h2>
            <Card>
              <CardContent className="pt-6">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-foreground">APY</dt>
                    <dd className="text-sm text-muted-foreground">Annual Percentage Yield - interest earned/paid per year</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Collateral</dt>
                    <dd className="text-sm text-muted-foreground">Assets locked to back a loan</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Collateral Factor</dt>
                    <dd className="text-sm text-muted-foreground">% of collateral value you can borrow</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Liability Factor</dt>
                    <dd className="text-sm text-muted-foreground">Liquidation threshold for borrowed value</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Backstop</dt>
                    <dd className="text-sm text-muted-foreground">Insurance pool protecting lenders</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">LP Token</dt>
                    <dd className="text-sm text-muted-foreground">Liquidity Provider token from backstop</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Q4W</dt>
                    <dd className="text-sm text-muted-foreground">Queue for Withdrawal - 21-day backstop exit lock</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Utilization</dt>
                    <dd className="text-sm text-muted-foreground">% of supplied assets that are borrowed</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">BLND</dt>
                    <dd className="text-sm text-muted-foreground">Blend protocol&apos;s governance/reward token</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Emissions</dt>
                    <dd className="text-sm text-muted-foreground">BLND rewards for platform participation</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Pool</dt>
                    <dd className="text-sm text-muted-foreground">A lending market for specific assets</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Liquidation</dt>
                    <dd className="text-sm text-muted-foreground">Forced sale when loan becomes under-collateralized</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="space-y-6 pb-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Ready to Get Started?</h2>
            <p className="text-muted-foreground">
              Connect your wallet and start earning on Blend Protocol
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button size="lg" className="w-full sm:w-auto">
                <Wallet className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/explore">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Explore Pools
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Need More Help?</CardTitle>
              <CardDescription>
                Explore these resources to learn more about Blend Protocol
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>Official Blend Protocol Documentation</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>Stellar Network Resources</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                  <span>Community Discord & Forums</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
