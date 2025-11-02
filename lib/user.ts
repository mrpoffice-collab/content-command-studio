import { currentUser } from '@clerk/nextjs/server';
import { db } from './db';

export async function syncUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  // Check if user exists
  const existingUser = await db.getUserByClerkId(clerkUser.id);

  if (existingUser) {
    return existingUser;
  }

  // Create new user
  const newUser = await db.createUser({
    clerk_id: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress || '',
    name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined,
  });

  return newUser;
}

export async function getCurrentUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const user = await db.getUserByClerkId(clerkUser.id);
  return user;
}
