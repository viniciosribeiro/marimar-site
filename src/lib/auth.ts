import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import postgres from "postgres";

declare module "next-auth" {
  interface User {
    role?: string;
    mustReset?: boolean;
  }
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      mustReset?: boolean;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
        try {
          const [user] = await sql`
            SELECT id, email, nome, senha_hash, papel, must_reset,
                   tentativas_falhas, bloqueado_ate
            FROM usuarios WHERE email = ${email}
          `;

          if (!user) {
            await bcrypt.compare(password, "$2a$12$" + "0".repeat(53));
            return null;
          }

          if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
            return null;
          }

          const ok = await bcrypt.compare(password, user.senha_hash);
          if (!ok) {
            const tentativas = (user.tentativas_falhas || 0) + 1;
            const bloqueadoAte = tentativas >= 5
              ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
              : null;
            await sql`
              UPDATE usuarios SET tentativas_falhas = ${tentativas},
                bloqueado_ate = ${bloqueadoAte ? bloqueadoAte : null}
              WHERE id = ${user.id}
            `;
            return null;
          }

          await sql`
            UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL,
              ultimo_login = NOW() WHERE id = ${user.id}
          `;

          return {
            id: user.id,
            email: user.email,
            name: user.nome,
            role: user.papel,
            mustReset: user.must_reset,
          };
        } finally {
          await sql.end();
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustReset = user.mustReset;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.mustReset = token.mustReset;
      }
      return session;
    },
  },
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  secret: process.env.AUTH_SECRET,
});