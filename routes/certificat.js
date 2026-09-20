const express = require("express");
const router = express.Router();
const Eleve = require("../models/Eleve"); 
const { createCertificat } = require('../controllers/certificatController');
const protect = require("../middleware/authMiddleware");
const Certificat = require("../models/certificatModel");

// Recherche par classe + nom/prénom (auto-complétion)
router.get("/eleves", protect ,  async (req, res) => {
  try {
    const { classe, search, annee } = req.query;

    if (!classe || !search || !annee) {
      return res.status(400).json({ error: "Classe, année et search sont requis" });
    }

    // On cherche les élèves de la classe + année scolaire
    const query = {
      classe,
      anneeScolaire: annee,
      $or: [
        { nom: { $regex: search, $options: "i" } },
        { prenom: { $regex: search, $options: "i" } }
      ]
    };

    const eleves = await Eleve.find(query)
      .select("nom prenom matricule dateNaissance lieuNaissance dateInscription classe anneeScolaire") // pas besoin de tout renvoyer
      .limit(10); // éviter d’envoyer trop de résultats

    if (eleves.length === 1) {
      return res.json({ unique: true, eleve: eleves[0] });
    }

    return res.json({ unique: false, eleves });
  } catch (err) {
    console.error("Erreur recherche élève :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// Routes certificat
router.post('/', protect, createCertificat);


// 📌 Route pour récupérer l'historique des certificats
router.get("/history", async (req, res) => {
  try {
    // On récupère les certificats triés du plus récent au plus ancien
    const certificats = await Certificat.find()
      .sort({ createdAt: -1 })
      .limit(50); // 🔥 Limite à 50 pour éviter surcharge

    res.json({ certificats });
  } catch (error) {
    console.error("Erreur historique certificats:", error);
    res.status(500).json({ message: "Erreur lors du chargement de l'historique" });
  }
});

module.exports = router;
