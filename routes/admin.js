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


// ➕ Ajouter un agent de caisse
router.post("/agent/", protect, async (req, res) => {
  try {
    const { nom, prenom, fonction } = req.body;

    if (!nom || !prenom) {
      return res.status(400).json({ error: "Nom et prénom requis." });
    }

    const agent = await AgentCaisse.create({
      user: req.user._id, // 🔑 rattacher à l'école connectée
      nom,
      prenom,
      fonction,
    });

    res.status(201).json(agent);
  } catch (err) {
    console.error("Erreur ajout agent:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📋 Lister tous les agents d'une école
router.get("/agent/", protect, async (req, res) => {
  try {
    const agents = await AgentCaisse.find({ user: req.user._id }).sort({ actif: -1, nom: 1 });
    res.json(agents);
  } catch (err) {
    console.error("Erreur liste agents:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✏️ Modifier un agent (nom, prénom, fonction, statut actif)
router.put("/agent/:id", protect, async (req, res) => {
  try {
    const { nom, prenom, fonction, actif } = req.body;

    const agent = await AgentCaisse.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id }, // sécurité : seulement ses agents
      { nom, prenom, fonction, actif },
      { new: true }
    );

    if (!agent) {
      return res.status(404).json({ error: "Agent non trouvé." });
    }

    res.json(agent);
  } catch (err) {
    console.error("Erreur update agent:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ❌ Supprimer un agent
router.delete("/agent/:id", protect, async (req, res) => {
  try {
    const agent = await AgentCaisse.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!agent) {
      return res.status(404).json({ error: "Agent non trouvé." });
    }

    res.json({ message: "Agent supprimé avec succès." });
  } catch (err) {
    console.error("Erreur suppression agent:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// @desc    Ajouter un élève
// @route   POST /api/eleves
// @access  Private
router.post("/eleve", protect, async (req, res) => {
  try {
    const {
      nom,
      prenom,
      dateNaissance,
      lieuNaissance,
      sexe,
      contact,
      matricule,
      classe,
      anneeScolaire,
    } = req.body;

    // Vérification de champs obligatoires
    if (!nom || !prenom || !sexe || !classe || !anneeScolaire) {
      return res.status(400).json({ message: "Champs obligatoires manquants." });
    }

    // Vérifier si le matricule existe déjà
    if (matricule) {
      const existe = await Eleve.findOne({ matricule });
      if (existe) {
        return res.status(400).json({ message: "Matricule déjà utilisé." });
      }
    }

    const nouvelEleve = new Eleve({
      nom,
      prenom,
      dateNaissance,
      lieuNaissance,
      sexe,
      contact,
      matricule,
      classe,
      anneeScolaire,
    });

    await nouvelEleve.save();

    res.status(201).json({
      message: "Élève enregistré avec succès.",
      data: nouvelEleve,
    });
  } catch (error) {
    console.error("Erreur enregistrement élève:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});


/* =========================
   GET LISTE D'ÉLÈVES PAR CLASSE
========================= */
router.get("/eleve", protect, async (req, res) => {
  try {
    const classe = req.query.classe;
    if (!classe) {
      return res.status(400).json({ message: "La classe est requise" });
    }

    const eleves = await Eleve.find({ classe }).sort({ nom: 1, prenom: 1 });
    res.json(eleves); // renvoie un array JSON
  } catch (err) {
    console.error("Erreur liste élèves:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
   MISE À JOUR D'UN ÉLÈVE
========================= */
router.put("/eleve/:id", protect, async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    // Validation côté backend si besoin
    if (data.contact && !/^[+\d][\d\s\-()]{6,20}$/.test(data.contact)) {
      return res.status(400).json({ message: "Numéro de contact invalide" });
    }

    const updated = await Eleve.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: "Élève non trouvé" });

    res.json({ message: "Élève mis à jour", data: updated });
  } catch (err) {
    console.error("Erreur update élève:", err);
    // Gestion des erreurs Mongoose
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message, errors: err.errors });
    }
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
   SUPPRESSION D'UN ÉLÈVE
========================= */
router.delete("/eleve/:id", protect, async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Eleve.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Élève non trouvé" });

    res.json({ message: "Élève supprimé" });
  } catch (err) {
    console.error("Erreur suppression élève:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});


module.exports = router;
