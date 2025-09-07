// middleware/protect.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ error: "Utilisateur non trouvé." });
      }

      next();
    } catch (err) {
      console.error("Erreur token:", err.message);
      return res.status(401).json({ error: "Token invalide ou expiré." });
    }
  } else {
    return res.status(401).json({ error: "Pas de token, accès refusé." });
  }
};

module.exports = protect;
