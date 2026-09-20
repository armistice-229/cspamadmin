const express = require("express");
const path = require("path");
const Eleve = require("../models/Eleve");
const Transaction = require("../models/OperationCaisse");
const FraisScolarite = require("../models/FraisScolarite");
const { getAnneeActive } = require("../models/Parametre");

const router = express.Router();

// Liste des classes existant pour une année donnée (par défaut : année active)
router.get("/classes", async (req, res) => {
  try {
    const anneeScolaire = req.query.annee || (await getAnneeActive());
    const classes = await Eleve.distinct("classe", { anneeScolaire });
    res.json(classes.sort());
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la récupération des classes." });
  }
});


router.get("/eleves/:classe", async (req, res) => {
  try {
    const anneeScolaire = req.query.annee || (await getAnneeActive());
    const eleves = await Eleve.find({ classe: req.params.classe, anneeScolaire }).sort({ nom: 1 });
    res.json(eleves);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la récupération des élèves." });
  }
});


// ✅ Génération du relevé de compte scolarité au format PDF pour un élève
const generateRelevePDF = require("../utils/generateRelevePDF");

router.get("/releve/:eleveId", async (req, res) => {
  try {
    const eleve = await Eleve.findById(req.params.eleveId);
    if (!eleve)
      return res.status(404).json({ message: "Élève introuvable." });

    // 1️⃣ Transactions de CETTE fiche élève uniquement (donc de SA seule année
    // scolaire) — plus besoin de deviner via le nom ou d'exclure des mots-clés :
    // chaque fiche élève est déjà propre à une seule année.
    const transactions = await Transaction.find({
      eleve: eleve._id,
      type: "entree",
    }).sort({ date: 1 });

    // 2️⃣ Frais de scolarité pour sa classe et son année
    const tarif = await FraisScolarite.findOne({
      classe: eleve.classe,
      anneeScolaire: eleve.anneeScolaire,
    });

    let montantScolarite = tarif ? tarif.montant : 0;

    // 3️⃣ Génération du PDF
    await generateRelevePDF(res, eleve, transactions, { montant: montantScolarite });

  } catch (err) {
    console.error("Erreur génération relevé :", err);
    res.status(500).json({ message: "Erreur lors de la génération du relevé." });
  }
});


router.get("/recap-paiements/:classe", async (req, res) => {
  try {
    const { classe } = req.params;
    const anneeScolaire = req.query.annee || (await getAnneeActive());

    // 1️⃣ Tous les élèves de la classe, pour cette année scolaire précise
    const eleves = await Eleve.find({ classe, anneeScolaire }).sort({ nom: 1 });

    if (!eleves.length) {
      return res.status(404).json({ message: "Aucun élève trouvé pour cette classe et cette année." });
    }

    // 2️⃣ Tarif de scolarité de la classe pour cette année
    const tarif = await FraisScolarite.findOne({ classe, anneeScolaire });
    const montantTotal = tarif ? tarif.montant : 0;

    const recap = [];

    // 3️⃣ Boucle élève par élève : transactions rattachées à SA fiche uniquement
    for (const eleve of eleves) {
      const transactions = await Transaction.find({
        eleve: eleve._id,
        type: "entree",
      });

      const montantPaye = transactions.reduce(
        (sum, t) => sum + (t.montant || 0),
        0
      );

      const restant = Math.max(montantTotal - montantPaye, 0);

      let observation = "Partiel";
      if (montantPaye === 0) observation = "Impayé";
      if (restant === 0) observation = "Soldé";

      recap.push({
        nom: eleve.nom,
        prenom: eleve.prenom,
        sexe: eleve.sexe,
        montant_paye: montantPaye,
        montant_total: montantTotal,
        montant_restant: restant,
        observation,
      });
    }

    // 4️⃣ Génération du PDF
    const genererRecapPaiementPDF = require("../utils/genererRecapPaiementPDF");
    await genererRecapPaiementPDF(res, recap, classe, anneeScolaire);

  } catch (err) {
    console.error("Erreur PDF récap :", err);
    res.status(500).json({ message: "Erreur génération PDF récapitulatif." });
  }
});


module.exports = router;
