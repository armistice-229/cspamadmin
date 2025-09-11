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

/* =========================
   LISTER LES TRANSACTIONS
========================= */
router.get("/", protect, async (req, res) => {
  try {
    const { type, eleve, from, to } = req.query;
    const filter = {};

    if (type) filter.type = type;
    if (eleve) filter.eleve = eleve;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .lean();

    res.json(transactions);
  } catch (err) {
    console.error("Erreur liste transactions:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =========================
   RECUPERER UNE TRANSACTION
========================= */
router.get("/:id", protect, async (req, res) => {
  try {
    const trx = await Transaction.findById(req.params.id);
    if (!trx) return res.status(404).json({ error: "Transaction introuvable" });
    res.json(trx);
  } catch (err) {
    console.error("Erreur get transaction:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =========================
   METTRE A JOUR UNE TRANSACTION
========================= */
router.put("/:id", protect, async (req, res) => {
  try {
    const data = req.body;

    // Si c'est une entrée, vérifier reçu
    if (data.type === "entree" && data.recu) {
      const recuExistant = await Transaction.findOne({
        recu: data.recu,
        type: "entree",
        _id: { $ne: req.params.id },
      });
      if (recuExistant) {
        return res.status(400).json({ error: `Le reçu ${data.recu} existe déjà.` });
      }
    }

    const updated = await Transaction.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ error: "Transaction introuvable" });
    res.json({ message: "Transaction mise à jour", data: updated });
  } catch (err) {
    console.error("Erreur update transaction:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =========================
   SUPPRIMER UNE TRANSACTION
========================= */
router.delete("/:id", protect, async (req, res) => {
  try {
    const deleted = await Transaction.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Transaction introuvable" });

    res.json({ message: "Transaction supprimée" });
  } catch (err) {
    console.error("Erreur delete transaction:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
