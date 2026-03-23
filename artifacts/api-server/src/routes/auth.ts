import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  const expectedUsername = process.env["ADMIN_USERNAME"] ?? "admin";
  const expectedPassword = process.env["ADMIN_PASSWORD"] ?? "";

  if (!expectedPassword) {
    return res.status(503).json({ error: "ADMIN_PASSWORD environment variable is not configured." });
  }

  if (username === expectedUsername && password === expectedPassword) {
    req.session.isAdmin = true;
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: "Session save failed" });
      }
      return res.json({ success: true, username: expectedUsername });
    });
  } else {
    return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    return res.json({ success: true });
  });
});

router.get("/me", (req, res) => {
  if (req.session.isAdmin) {
    const username = process.env["ADMIN_USERNAME"] ?? "admin";
    return res.json({ isAuthenticated: true, username });
  }
  return res.status(401).json({ isAuthenticated: false });
});

export default router;
