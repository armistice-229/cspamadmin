const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Générer un token JWT
function generateToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "5h" }
  );
}

// ✅ Connexion
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Identifiant invalide." });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ error: "Mot de passe invalide." });

    const token = generateToken(user);

    res.json({
      message: "Connexion réussie",
      token,
      user: { id: user._id, username: user.username, role: user.role, nom: user.nom }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Vérifier si le token est valide
router.get("/verify-token", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Token valide ✅",
    user: req.user, // Infos utilisateur décodées du token
  });
});

module.exports = router;
