const express = require("express");
const Transaction = require("../models/OperationCaisse");
const generateRapportPDF = require("../utils/rapportJournalier"); // import utilitaire
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const Eleve = require("../models/Eleve");
const genererListePDF = require("../utils/elevesListePDF");
const { getAnneeActive } = require("../models/Parametre");

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



// Liste ALPHABETIQUE des élèves d'une classe
// // GET /api/eleves/liste/:classe?annee=2025-2026
router.get("/liste/:classe", protect, async (req, res) => {
  try {
    const { classe } = req.params;
    const anneeScolaire = req.query.annee || (await getAnneeActive());

    const eleves = await Eleve.find({ classe, anneeScolaire })
      .collation({ locale: "fr", strength: 2 })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    if (!eleves.length) {
      return res.status(404).json({ message: "Aucun élève trouvé pour cette classe." });
    }

    // Génération PDF
    genererListePDF(res, eleves, classe, anneeScolaire);
  } catch (error) {
    console.error("Erreur génération liste PDF:", error);
    res.status(500).json({ message: "Erreur serveur lors de la génération du PDF." });
  }
});



module.exports = router;
