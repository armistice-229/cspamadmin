const express = require("express");
const Transaction = require("../models/OperationCaisse");
const generateRapportPDF = require("../utils/rapportJournalier"); // import utilitaire
const router = express.Router();
const protect = require("../middleware/authMiddleware");

// Toutes les routes protégées
router.use(protect);

// utilitaire pour formater date en JJ/MM/AAAA
function formatDate(d) {
  return d.toLocaleDateString("fr-FR");
}

router.get("/journalier", async (req, res) => {
  try {
    let dateParam = req.query.date ? new Date(req.query.date) : new Date();

    let start = new Date(dateParam.setHours(0, 0, 0, 0));
    let end = new Date(dateParam.setHours(23, 59, 59, 999));

    // === 🔹 Transactions du jour ===
    const transactions = await Transaction.find({
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    const entrees = transactions.filter(t => t.type === "entree");
    const sorties = transactions.filter(t => t.type === "sortie");

    // === 🔹 Calcul du solde d'ouverture ===
    const prevTransactions = await Transaction.find({
      date: { $lt: start }
    });

    const totalEntreesPrev = prevTransactions
      .filter(t => t.type === "entree")
      .reduce((s, e) => s + e.montant, 0);

    const totalSortiesPrev = prevTransactions
      .filter(t => t.type === "sortie")
      .reduce((s, e) => s + e.montant, 0);

    const soldeOuverture = totalEntreesPrev - totalSortiesPrev;

    // === 🔹 Infos caissier ===
    const caissier = entrees[0]?.createdBy || sorties[0]?.createdBy || "Aucun mouvement";

    // === 🔹 Structurer les données pour PDF ===
    const data = {
      date: formatDate(start),
      caissier,
      fonde: "Aimé Coffi ANAGONOU",
      soldeOuverture,
      entrees: entrees.map(e => ({
        montant: e.montant,
        reference: e.reference,
        eleve: e.nomEleve || "-",
        motif: e.motifs || "-"
      })),
      sorties: sorties.map(s => ({
        montant: s.montant,
        reference: s.reference,
        categorie: s.categorie || "-",
        motif: s.description || "-"
      }))
    };

    // === 🔹 Générer PDF ===
    generateRapportPDF(res, data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la génération du PDF" });
  }
});


module.exports = router;
