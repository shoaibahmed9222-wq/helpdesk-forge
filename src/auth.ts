import "server-only";

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";

import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { sendOutboundEmail } from "@/lib/outbound-email";
import { emailFromAddress, productionIssues } from "@/lib/production-config";

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
      // Required by the provider type. Development never connects, and production
      // sends through sendOutboundEmail instead of this server object.
      server: {
        host: process.env.SMTP_HOST?.trim() || "127.0.0.1",
        port: Number(process.env.SMTP_PORT || "1025"),
        ...(process.env.SMTP_USER?.trim()
          ? { auth: { user: process.env.SMTP_USER.trim(), pass: process.env.SMTP_PASS ?? "" } }
          : {}),
      },
      from: emailFromAddress() || "Helpdesk Forge <noreply@localhost>",
      async sendVerificationRequest({ identifier, url }) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`\n[helpdesk] Sign-in link for ${identifier}\n${url}\n`);
          return;
        }
        const smtp = productionIssues().filter(
          (issue) => issue.code === "smtp" || issue.code === "email_from",
        );
        if (smtp.length > 0) {
          throw new Error(smtp.map((issue) => issue.message).join(" "));
        }
        await sendOutboundEmail({
          from: emailFromAddress(),
          to: identifier,
          subject: "Sign in to Helpdesk Forge",
          text: `Sign in to Helpdesk Forge by opening this link:\n\n${url}\n\nIf you did not ask for this, you can ignore the email.\n`,
        });
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
