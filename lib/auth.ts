/* eslint-disable @typescript-eslint/no-explicit-any */
import { compare } from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

import { prisma } from './prisma';

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    CredentialsProvider({
      name: '邮箱密码登录',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email.toLowerCase() } });
        if (!user?.password || user.disabled) return null;

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
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID || '',
      clientSecret: process.env.GOOGLE_SECRET || ''
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      const email = user.email?.toLowerCase();
      if (!email || !account.providerAccountId) return false;

      const emailVerified = (profile as any)?.email_verified === true;
      if (!emailVerified) return false;

      const existingAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId
          }
        }
      });

      let dbUser: any = null;
      if (existingAccount) {
        dbUser = await prisma.user.findUnique({ where: { id: existingAccount.userId } });
      } else {
        const userByEmail = await prisma.user.findUnique({ where: { email } });
        if (!userByEmail) {
          dbUser = await prisma.user.create({
            data: {
              email,
              name: user.name,
              image: user.image,
              emailVerified: new Date().toISOString(),
              role: adminEmails.includes(email) ? 'ADMIN' : 'USER'
            }
          });
        } else {
          if (userByEmail.password) {
            return '/login?error=OAuthAccountNotLinked';
          }
          dbUser = userByEmail;
        }

        await prisma.account.create({
          data: {
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state as string | null
          }
        });
      }

      if (!dbUser || dbUser.disabled) return false;

      const role = adminEmails.includes(email) ? 'ADMIN' : dbUser.role;
      if (role !== dbUser.role) {
        dbUser = await prisma.user.update({ where: { id: dbUser.id }, data: { role } });
      }

      user.id = dbUser.id;
      (user as any).role = dbUser.role;
      user.email = dbUser.email;
      user.name = dbUser.name;
      user.image = dbUser.image;
      return true;
    },
    async jwt({ token, user }) {
      if (token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email.toLowerCase() } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role || 'USER';
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.picture = dbUser.image;
        }
      }
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role || token.role || 'USER';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || 'USER';
        session.user.email = (token.email as string) || session.user.email;
      }
      return session;
    }
  }
};
