const express = require("express");
const router = express.Router();
const Eleve = require("../models/Eleve");
const FraisScolarite = require("../models/FraisScolarite");
const protect = require("../middleware/authMiddleware");

// Toutes les routes protégées
router.use(protect);

// Import massif d'élèves (après parsing Excel côté client)

router.post("/upload/eleves/import", async (req, res) => {
  try {
    const eleves = req.body; // tableau d'élèves
    if (!Array.isArray(eleves) || eleves.length === 0) {
      return res.status(400).json({ error: "Aucune donnée reçue" });
    }
    await Eleve.insertMany(eleves);
    res.json({ message: "Importation réussie" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔍 Recherche par matricule
router.get("/upload/search/:matricule", async (req, res) => {
  try {
    const { matricule } = req.params;

    const eleve = await Eleve.findOne({ matricule });

    if (!eleve) {
      return res.status(404).json({ message: "Élève non trouvé" });
    }

    res.json(eleve);
  } catch (error) {
    console.error("Erreur recherche élève:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ➡️ Créer un frais de scolarité
router.post("/frais/", async (req, res) => {
  try {
    const { classe, montant, anneeScolaire } = req.body;

    if (!classe || !montant || !anneeScolaire) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    // Vérifier si déjà défini pour cette classe & année
    const existant = await FraisScolarite.findOne({ classe, anneeScolaire });
    if (existant) {
      return res.status(400).json({ error: "Frais déjà défini pour cette classe et année." });
    }

    const frais = new FraisScolarite({ classe, montant, anneeScolaire });
    await frais.save();

    res.status(201).json(frais);
  } catch (err) {
    console.error("Erreur POST /api/frais :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ➡️ Lire tous les frais
router.get("/frais/", async (req, res) => {
  try {
    const frais = await FraisScolarite.find().sort({ anneeScolaire: -1, classe: 1 });
    res.json(frais);
  } catch (err) {
    console.error("Erreur GET /api/frais :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Inscription (création d’un utilisateur)
router.post("/users/register", async (req, res) => {
  try {
    const { username, password, nom, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username et mot de passe requis." });
    }

    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ error: "Cet identifiant existe déjà." });
    }

    const user = await User.create({ username, password, nom, role });
    res.status(201).json({
      message: "Utilisateur créé avec succès",
      user: { id: user._id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;
