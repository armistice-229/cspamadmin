// middleware/authorize.js
module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Utilisateur non authentifié." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé." });
    }
    next();
  };
};
