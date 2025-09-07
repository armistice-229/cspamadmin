const express = require("express");
const router = express.Router();
const protect  = require("../middleware/authMiddleware");
const Transaction = require("../models/OperationCaisse");
const Eleve = require("../models/Eleve")

// Ajouter une transaction
router.post("/", protect, async (req, res) => {
  try {
    const { type, montant, recu, motifs, eleve, nomEleve, categorie, description } = req.body;

    if (!["entree", "sortie"].includes(type)) {
      return res.status(400).json({ error: "Type invalide (entree | sortie)" });
    }

    if (!montant || montant <= 0) {
      return res.status(400).json({ error: "Montant valide requis." });
    }

    const payload = {
      type,
      montant,
      date: req.body.date ? new Date(req.body.date) : new Date(), // ✅ date choisie ou aujourd’hui
      reference: "TRX" + Date.now(),
      createdBy: req.user.nom,
    };


    if (type === "entree") {
      if (!eleve || !recu) {
        return res.status(400).json({ error: "Élève et reçu requis pour une entrée." });
      }

      // Vérifier si un reçu identique existe déjà
      const recuExistant = await Transaction.findOne({ recu, type: "entree" });
      if (recuExistant) {
        return res.status(400).json({ error: `Le reçu ${recu} existe déjà pour une autre entrée.` });
      }
      payload.eleve = eleve;
      payload.recu = recu;
      payload.motifs = motifs;

      // 🔑 snapshot nom de l’élève
        const eleveDoc = await Eleve.findById(eleve).select("nom prenom");
        if (eleveDoc) {
            payload.nomEleve = `${eleveDoc.nom} ${eleveDoc.prenom}`;
        }
    }

    if (type === "sortie") {
      if (!categorie) {
        return res.status(400).json({ error: "Catégorie requise pour une sortie." });
      }
      payload.categorie = categorie;
      payload.description = description;
    }

    const transaction = await Transaction.create(payload);
    res.status(201).json(transaction);
  } catch (err) {
    console.error("Erreur transaction:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Lister toutes les transactions  (avec infos élève si entrée)
router.get("/", protect, async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 }).populate("eleve", "nom prenom classe");
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
