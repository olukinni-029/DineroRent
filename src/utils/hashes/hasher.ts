import { hash as bcryptHash, compare as bcryptCompare, genSalt as bcryptGenSalt } from 'bcrypt';

export const hash = async (value: string): Promise<string> => {
  const salt = await bcryptGenSalt(10);
  return bcryptHash(value, salt);
};

export const compare = async (value: string, hash: string): Promise<boolean> => {
  return bcryptCompare(value, hash);
};