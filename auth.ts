import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import client from "@/lib/db";
import Discord from "next-auth/providers/discord";
import Twitch from "next-auth/providers/twitch";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(client),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  secret: process.env.AUTH_SECRET,
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
    }),
    Twitch({
      clientId: process.env.AUTH_TWITCH_ID!,
      clientSecret: process.env.AUTH_TWITCH_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account) return false;

      await client.connect();
      const db = client.db();

      const existingUser = await db.collection("users").findOne({ email: user.email });

      if (existingUser) {
        const existingAccount = await db.collection("accounts").findOne({
          userId: existingUser._id,
          provider: account.provider,
        });

        if (!existingAccount) {
          await db.collection("accounts").insertOne({
            userId: existingUser._id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            type: account.type,
            access_token: account.access_token,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          });
        }

      }

      if (account.provider === "twitch" && profile?.login && user.email) {
        await db.collection("users").updateOne(
          existingUser ? { _id: existingUser._id } : { email: user.email },
          { $set: { twitchLogin: profile.login, twitchUserId: account.providerAccountId } }
        );
      }

      return true;
    },
    async session({ session, token }) {
      // `sub` is the adapter user id. Keep /api/auth/session cheap; routes that
      // need live profile state read it directly from MongoDB.
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
});
