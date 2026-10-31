import "server-only";

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";

import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/verify",
    error: "/signin",
  },
  providers: [
    Nodemailer({
      // Required by the provider. Development never connects to it.
      server: "smtp://127.0.0.1:1025",
      from: "Helpdesk Forge <noreply@localhost>",
      async sendVerificationRequest({ identifier, url }) {
        if (process.env.NODE_ENV === "production") {
          throw new Error("Email delivery is not configured.");
        }
        console.log(`\n[helpdesk] Sign-in link for ${identifier}\n${url}\n`);
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
