/* eslint-disable @typescript-eslint/no-explicit-any */
import { compare } from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

import { prisma } from './prisma';
import { SUPER_ADMIN_EMAIL, isRegistrationEnabled } from './site-settings';

const adminEmails = [SUPER_ADMIN_EMAIL, ...(process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)];

const adminEmailSet = new Set(adminEmails);

function maskEmail(email?: string | null) {
  if (!email) return 'unknown';
  const [name, domain] = email.toLowerCase().split('@');
  if (!domain) return 'unknown';
  const head = name.slice(0, 2);
  return `${head}***@${domain}`;
}

function authAudit(event: string, detail: Record<string, unknown> = {}) {
  console.info(
    JSON.stringify({
      type: 'auth_audit',
      event,
      ts: new Date().toISOString(),
      ...detail
    })
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  providers: (() => {
    const providers: NextAuthOptions['providers'] = [
      CredentialsProvider({
        name: '邮箱密码登录',
        credentials: {
          email: { label: '邮箱', type: 'email' },
          password: { label: '密码', type: 'password' }
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials.password) {
            authAudit('credentials_reject', { reason: 'missing_credentials' });
            return null;
          }

          const user = await prisma.user.findUnique({ where: { email: credentials.email.toLowerCase() } });
          if (!user?.password || user.disabled) {
            authAudit('credentials_reject', {
              reason: user?.disabled ? 'user_disabled_or_blocked' : 'user_not_found_or_no_password',
              email: maskEmail(credentials.email)
            });
            return null;
          }

          const valid = await compare(credentials.password, user.password);
          if (!valid) {
            authAudit('credentials_reject', { reason: 'bad_password', email: maskEmail(credentials.email) });
            return null;
          }

          const role = adminEmailSet.has(user.email.toLowerCase()) ? 'ADMIN' : user.role;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              ...(role !== user.role ? { role } : {}),
              last_login_at: new Date().toISOString()
            }
          });

          authAudit('credentials_success', { email: maskEmail(user.email), userId: user.id, role });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role
          } as any;
        }
      })
    ];

    if (process.env.GOOGLE_ID && process.env.GOOGLE_SECRET) {
      providers.push(
        GoogleProvider({
          clientId: process.env.GOOGLE_ID,
          clientSecret: process.env.GOOGLE_SECRET
        })
      );
    }

    return providers;
  })(),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      const email = user.email?.toLowerCase();
      if (!email || !account.providerAccountId) {
        authAudit('google_reject', { reason: 'missing_email_or_provider_account' });
        return false;
      }

      const emailVerified = (profile as any)?.email_verified === true;
      if (!emailVerified) {
        authAudit('google_reject', { reason: 'email_not_verified', email: maskEmail(email) });
        return '/login?error=EmailNotVerified';
      }

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
          const registrationEnabled = await isRegistrationEnabled();
          if (!registrationEnabled) {
            authAudit('google_reject', { reason: 'registration_disabled', email: maskEmail(email) });
            return '/login?error=RegistrationDisabled';
          }
          dbUser = await prisma.user.create({
            data: {
              email,
              name: user.name,
              image: user.image,
              emailVerified: new Date().toISOString(),
              role: adminEmailSet.has(email) ? 'ADMIN' : 'USER'
            }
          });
        } else {
          if (userByEmail.password) {
            authAudit('google_reject', { reason: 'oauth_account_not_linked', email: maskEmail(email) });
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

      if (!dbUser || dbUser.disabled) {
        authAudit('google_reject', { reason: 'user_disabled_or_missing', email: maskEmail(email) });
        return false;
      }

      const role = adminEmailSet.has(email) ? 'ADMIN' : dbUser.role;
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          ...(role !== dbUser.role ? { role } : {}),
          last_login_at: new Date().toISOString()
        }
      });

      user.id = dbUser.id;
      (user as any).role = dbUser.role;
      user.email = dbUser.email;
      user.name = dbUser.name;
      user.image = dbUser.image;
      authAudit('google_success', { email: maskEmail(dbUser.email), userId: dbUser.id, role: dbUser.role });
      return true;
    },
    async jwt({ token, user }) {
      if (token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email.toLowerCase() } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = adminEmailSet.has(dbUser.email.toLowerCase()) ? 'ADMIN' : dbUser.role || 'USER';
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
