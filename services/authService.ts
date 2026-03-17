
import { UserAccount } from '../types';
import { db, DEFAULT_ADMIN } from './db';

// Ensure DB is initialized
export const getUsers = async (): Promise<UserAccount[]> => {
  return await db.users.getAll();
};

export const saveUser = async (user: UserAccount): Promise<{ success: boolean, message: string }> => {
  // Simple validation
  if (!user.username || !user.password) {
      return { success: false, message: 'Username and password are required.' };
  }
  
  const success = await db.users.add({
    ...user,
    uid: user.username
  });
  if (success) {
      return { success: true, message: 'User successfully saved to database.' };
  } else {
      return { success: false, message: 'Username already exists.' };
  }
};

export const deleteUser = async (username: string): Promise<{ success: boolean, message: string }> => {
  if (username === 'admin') {
      return { success: false, message: 'Cannot delete the main admin account.' };
  }
  
  const success = await db.users.delete(username);
  if (success) {
      return { success: true, message: 'User deleted from database.' };
  } else {
      return { success: false, message: 'User not found.' };
  }
};

export const login = async (username: string, password: string): Promise<UserAccount | null> => {
  const user = await db.users.get(username);
  if (user) {
    if (user.password === password) return user;
    return null;
  }
  
  // Fallback for default admin if not in DB
  if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
    return DEFAULT_ADMIN;
  }
  
  return null;
};

export const changePassword = async (username: string, newPassword: string): Promise<{ success: boolean, message: string }> => {
  const users = await getUsers();
  const user = users.find(u => u.username === username);
  
  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  const updatedUser: UserAccount & { uid: string } = {
    ...user,
    password: newPassword,
    uid: user.username
  };

  const success = await db.users.add(updatedUser);
  if (success) {
    return { success: true, message: 'Password successfully updated.' };
  } else {
    return { success: false, message: 'Failed to update password.' };
  }
};
