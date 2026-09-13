import type { MetadataRoute } from "next";

const BASE_URL = "https://hashpop.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Account-scoped and internal surfaces — nothing useful to index.
        disallow: [
          "/admin",
          "/area51",
          "/dashboard",
          "/purchases",
          "/offers",
          "/messages",
          "/activity",
          "/cart",
          "/watchlist",
          "/selling",
          "/purchase-success",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
