import NextAuth, { DefaultSession, Session, NextAuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import db from '../../../../lib/db';
import type { User } from 'next-auth';

declare module 'next-auth' {
  interface User {
    username: string;
  }
  
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
    } & DefaultSession['user']
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const result = await db.query('SELECT * FROM users WHERE email = $1', [credentials.email]);
        const user = result.rows[0];

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          return null;
        }
        console.log(user, "User First")
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt' as const
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.username = token.username as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
};

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST };

