import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Hashpop",
  description: "Privacy Policy for Hashpop marketplace.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen slide-in-right">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-silver text-sm mb-8">Last updated: February 2025</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-silver">
          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">1. Agreement by use</h2>
            <p>
              By using Hashpop (&quot;the Service&quot;), you agree to this Privacy Policy. If you
              do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">2. What we collect</h2>
            <p>We may collect or process the following in connection with the Service:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>Wallet address</strong> — When you connect a wallet, we use your public
                address to show your listings, bids, and activity. This is necessary to sync with
                the blockchain and provide the marketplace.
              </li>
              <li>
                <strong>Listing data</strong> — Titles, descriptions, images, prices, and other
                details you submit when creating or editing listings. This is stored to display and
                index the marketplace.
              </li>
              <li>
                <strong>Uploaded files</strong> — Images and media you upload for listings. We store
                these to serve listing pages.
              </li>
              <li>
                <strong>Log and usage data</strong> — Server logs (e.g. IP address, request time,
                path) and general usage of the site for operation, security, and debugging.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">3. Why we use it</h2>
            <p>
              We use this information to provide and operate the Service (e.g. showing listings,
              syncing with the blockchain, serving images), to improve and secure the Service, and
              to comply with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">4. How long we keep it</h2>
            <p>
              We retain listing and upload data for as long as the listing exists or as needed to
              operate the Service. Log data may be kept for a limited period for security and
              debugging. We may retain some data where required by law or to enforce our Terms of
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">5. Sharing</h2>
            <p>
              We do not sell your personal information. We may share data with service providers
              that help us run the Service (e.g. hosting, databases), subject to appropriate
              safeguards. Wallet addresses and listing data are public on the blockchain and may be
              visible to anyone.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">6. Your choices</h2>
            <p>
              You can disconnect your wallet from the site at any time. Listing data you have
              created may remain in our systems and on the blockchain. For specific requests (e.g.
              access or deletion), contact us through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">7. Changes</h2>
            <p>
              We may update this Privacy Policy from time to time. Continued use after changes means
              you accept the updated policy. We encourage you to review this page periodically.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-2">8. Contact</h2>
            <p>
              For questions about this Privacy Policy, please use the contact or help options
              provided on the Service.
            </p>
          </section>
        </div>

        <p className="mt-10 text-silver text-sm">
          <Link href="/" className="text-chrome hover:text-white underline">
            Back to home
          </Link>
          {" · "}
          <Link href="/terms" className="text-chrome hover:text-white underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </main>
  );
}
