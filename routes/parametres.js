const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const { getAnneeActive, setAnneeActive } = require("../models/Parametre");

router.use(protect);

// GET /api/parametres/annee-active
// Toute personne connectée peut lire l'année active (utile pour préremplir les formulaires/filtres)
router.get("/annee-active", async (req, res) => {
  try {
    const annee = await getAnneeActive();
    res.json({ anneeScolaireActive: annee });
  } catch (err) {
    console.error("Erreur lecture année active:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /api/parametres/annee-active   { "annee": "2025-2026" }
// Réservé à l'admin/directeur : c'est le geste à faire chaque rentrée scolaire.
router.put("/annee-active", authorize("admin", "directeur"), async (req, res) => {
  try {
    const { annee } = req.body;
    if (!annee || !/^\d{4}-\d{4}$/.test(annee)) {
      return res.status(400).json({ error: "Format attendu : AAAA-AAAA (ex: 2025-2026)" });
    }
    const valeur = await setAnneeActive(annee);
    res.json({ message: "Année scolaire active mise à jour", anneeScolaireActive: valeur });
  } catch (err) {
    console.error("Erreur mise à jour année active:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
