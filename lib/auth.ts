/* eslint-disable @typescript-eslint/no-explicit-any */
import { compare } from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { prisma } from './prisma';

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: '邮箱密码登录',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user?.password) return null;

        const valid = await compare(credentials.password, user.password);
        if (!valid) return null;

        const role = adminEmails.includes(user.email.toLowerCase()) ? 'ADMIN' : user.role;
        if (role !== user.role) {
          await prisma.user.updateMany({ where: { email: user.email.toLowerCase() }, data: { role } });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role || 'USER';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || 'USER';
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      try {
        const parsed = new URL(url, baseUrl);
        const isLoginPath = parsed.pathname === '/login';
        const callbackUrl = parsed.searchParams.get('callbackUrl') || '';

        if (isLoginPath || callbackUrl.includes('/login')) {
          return `${baseUrl}/dashboard`;
        }

        if (parsed.origin === new URL(baseUrl).origin) return parsed.toString();
      } catch {
        // ignore and fallback below
      }
      return `${baseUrl}/dashboard`;
    }
  }
};
