import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// locale is set at sign-up from the language the person is using, so their emails come in it.
export const authClient = createAuthClient({
  // oauthProviderClient carries the signed OAuth request through sign-in, workspace choice and consent.
  plugins: [
    inferAdditionalFields({ user: { locale: { type: "string", required: false } } }),
    oauthProviderClient(),
  ],
});
