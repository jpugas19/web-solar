import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { sql } from "./db";
import type { User } from "./types";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(
  userId: string,
  email: string
): Promise<string> {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function getUserFromRequest(
  request: Request
): Promise<{ userId: string; email: string } | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...val] = c.trim().split("=");
      return [key, val.join("=")];
    })
  );
  const token = cookies["session"];
  if (!token) return null;
  return verifyToken(token);
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<Omit<User, "password_hash"> | null> {
  const result = await sql`
    SELECT id, email, password_hash, name, created_at
    FROM users WHERE email = ${email} LIMIT 1
  `;
  if (result.length === 0) return null;

  const user = result[0] as User;
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.created_at,
  };
}
