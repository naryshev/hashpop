import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Hashpop",
  description: "Terms of Service for Hashpop marketplace.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-silver text-sm mb-8">Last updated: February 2025</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-silver">
          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">1. Agreement by use</h2>
            <p>
              By accessing or using Hashpop (&quot;the Service&quot;), you agree to be bound by
              these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">
              2. Description of the Service
            </h2>
            <p>
              Hashpop is a decentralized marketplace where users can list, browse, buy, and bid on
              items. Listings and listings are created by users and are recorded on a blockchain
              (Hedera). We provide a web interface and backend to sync and display that data; we do
              not take custody of your assets.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">
              3. User-generated content and listings
            </h2>
            <p>
              All listings, images, descriptions, and other content on the Service are created by
              users. We do not endorse, verify, or guarantee any listing or user. You are solely
              responsible for your own listings and for evaluating other users and listings before
              transacting. We are not a party to any transaction between users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">
              4. &quot;As is&quot; and no warranty
            </h2>
            <p>
              The Service is provided <strong>&quot;as is&quot;</strong> and{" "}
              <strong>&quot;as available&quot;</strong> without warranties of any kind, express or
              implied. We disclaim all warranties, including merchantability, fitness for a
              particular purpose, and non-infringement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">
              5. Crypto and listings at your own risk
            </h2>
            <p>
              Use of cryptocurrency (including HBAR) and smart contracts involves risk. Prices and
              availability can change. Transactions may be irreversible. We do not guarantee the
              accuracy of prices, the completion of any sale or the behavior of other users or
              third-party systems. You use the Service at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">
              6. Not financial or legal advice
            </h2>
            <p>
              Nothing on the Service constitutes financial, investment, tax, or legal advice. You
              should seek qualified professionals for such advice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">
              7. No guarantee of security, uptime, or returns
            </h2>
            <p>
              We do not guarantee that the Service will be secure, uninterrupted, or error-free. We
              do not guarantee any particular uptime or availability. We do not guarantee any
              returns, outcomes, or results from using the Service or from any transaction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">8. Acceptable use</h2>
            <p>
              You agree not to use the Service for any illegal purpose or to violate any applicable
              laws. You must not post false, misleading, or infringing content, or use the Service
              to harm others or our infrastructure. We may suspend or terminate access for
              violations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">9. Changes</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after
              changes constitutes acceptance of the updated Terms. We encourage you to review this
              page periodically.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">10. Contact</h2>
            <p>
              For questions about these Terms, please use the contact or help options provided on
              the Service.
            </p>
          </section>
        </div>

        <p className="mt-10 text-silver text-sm">
          <Link href="/" className="text-chrome hover:text-white underline">
            Back to home
          </Link>
          {" · "}
          <Link href="/privacy" className="text-chrome hover:text-white underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}
