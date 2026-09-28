import { registerUser, loginUser, getMe } from "../services/auth.service.js";

export async function register(req, res) {
  // Only these three fields are read. Anything else (role, isActive...) is ignored.
  const { name, email, password } = req.body;
  const result = await registerUser({ name, email, password }, req);
  res.status(201).json({ success: true, ...result });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const result = await loginUser({ email, password }, req);
  res.json({ success: true, ...result });
}

export async function me(req, res) {
  const result = await getMe(req.user);
  res.json({ success: true, serverTime: new Date().toISOString(), ...result });
}