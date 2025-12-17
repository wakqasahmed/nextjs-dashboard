import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials'; 
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: process.env.NODE_ENV === 'production' ? 'require' : false });
 
async function getUser(email: string): Promise<User | undefined> {
  try {
    console.log('Attempting to fetch user with email:', email);
    const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
    console.log('User query result:', user);
    if (user.length === 0) {
      console.log('No user found with email:', email);
    } else {
      console.log('User found:', { id: user[0].id, name: user[0].name, email: user[0].email });
    }
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        console.log('Authentication attempt with credentials:', {
          email: credentials?.email,
          passwordLength: typeof credentials?.password === 'string' ? credentials.password.length : 'undefined'
        });
        
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          console.log('Credential validation failed:', parsedCredentials.error);
          return null;
        }

        const { email, password } = parsedCredentials.data;
        console.log('Parsed credentials:', { email, passwordLength: password.length });
        
        const user = await getUser(email);
        if (!user) {
          console.log('Authentication failed: User not found');
          return null;
        }
        
        console.log('Comparing passwords...');
        const passwordsMatch = await bcrypt.compare(password, user.password);
        console.log('Password match result:', passwordsMatch);
 
        if (passwordsMatch) {
          console.log('Authentication successful for user:', email);
          return user;
        }

        console.log('Authentication failed: Passwords do not match');
        return null;
      },
    }),
  ],
});