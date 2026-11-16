import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { aggregatorWebhookHandler } from "./aggregatorWebhook";

const http = httpRouter();

auth.addHttpRoutes(http);

// Third-party aggregator webhooks (Zomato, Swiggy, UrbanPiper, Petpooja, custom)
http.route({
  pathPrefix: "/aggregator/webhook/",
  method: "POST",
  handler: aggregatorWebhookHandler,
});

export default http;
