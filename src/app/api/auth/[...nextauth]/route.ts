import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Use `drive.file` only — per-file access to files the app creates.
          // Works for both Drive API and Sheets API on app-owned files.
          // Avoids RESTRICTED scope verification (no CASA needed).
          scope:
            "openid email profile https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    // Single demo account for platform reviewers (e.g. Shopee) to log in with a
    // username/password, since normal users sign in with Google. Enabled only
    // when both env vars are set; grants access to a seeded demo account only.
    CredentialsProvider({
      id: "demo",
      name: "Demo",
      credentials: {
        email:    { label: "Email",    type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const demoEmail = process.env.DEMO_LOGIN_EMAIL?.toLowerCase().trim();
        const demoPass  = process.env.DEMO_LOGIN_PASSWORD;
        if (!demoEmail || !demoPass) return null;
        const email = credentials?.email?.toLowerCase().trim();
        if (email === demoEmail && credentials?.password === demoPass) {
          return { id: demoEmail, email: demoEmail, name: "Shopee Reviewer (Demo)" };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    },
    async session({ session, token }) {
      const s = session as typeof session & { accessToken?: string; refreshToken?: string };
      s.accessToken  = token.accessToken  as string;
      s.refreshToken = token.refreshToken as string;
      return s;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
