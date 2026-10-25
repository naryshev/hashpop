import { FAQS } from "../../lib/help/faqs";
import { faqPageJsonLd, serializeJsonLd } from "../../lib/seo/jsonld";
import HelpCenter from "./help-center";

export default function HelpPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqPageJsonLd(FAQS)) }}
      />
      <HelpCenter faqs={FAQS} />
    </>
  );
}
