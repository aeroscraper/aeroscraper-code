import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { createStytchHeadlessClient } from "@stytch/nextjs/headless";
import { StytchHeadlessClient } from "@stytch/vanilla-js/dist/index.headless";

// TODO: Temporarily hard-coded
export const stytchClient: StytchHeadlessClient = createStytchHeadlessClient(
  "public-token-live-87901ec3-ef19-48ca-b3f4-842be750181b"//"public-token-live-52650940-d7fb-4e24-8abc-cf5f32c80a05" //"public-token-live-87901ec3-ef19-48ca-b3f4-842be750181b",
);

// TODO: Refactor to be dynamic. Local dev uri must be device IP.
export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: "https://api.subquery.network/sq/burnt-labs/xion-indexer",
  }),
  cache: new InMemoryCache(),
  assumeImmutableResults: true,
});
