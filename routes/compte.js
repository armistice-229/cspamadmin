const express = require("express");
const path = require("path");
const Eleve = require("../models/Eleve");
const Transaction = require("../models/OperationCaisse");
const FraisScolarite = require("../models/FraisScolarite");

const router = express.Router();

router.get("/classes", async (req, res) => {
  try {
    const classes = await Eleve.distinct("classe");
    res.json(classes.sort());
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la récupération des classes." });
  }
});


router.get("/eleves/:classe", async (req, res) => {
  try {
    const eleves = await Eleve.find({ classe: req.params.classe }).sort({ nom: 1 });
    res.json(eleves);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la récupération des élèves." });
  }
});


// ✅ Génération du relevé de compte scolarité au format PDF pour un élève
const generateRelevePDF = require("../utils/generateRelevePDF");

/*// ✅ Génération du relevé de compte scolarité au format PDF
router.get("/releve/:eleveId", async (req, res) => {
  try {
    const eleve = await Eleve.findById(req.params.eleveId);
    if (!eleve)
      return res.status(404).json({ message: "Élève introuvable." });

    const transactions = await Transaction.find({
      eleve: eleve._id,
      type: "entree",
    }).sort({ date: 1 });

    const tarif = await FraisScolarite.findOne({
      classe: eleve.classe,
      anneeScolaire: eleve.anneeScolaire,
    });

    await generateRelevePDF(res, eleve, transactions, tarif);
  } catch (err) {
    console.error("Erreur génération relevé :", err);
    res.status(500).json({ message: "Erreur lors de la génération du relevé." });
  }
});

*/

router.get("/releve/:eleveId", async (req, res) => {
  try {
    const eleve = await Eleve.findById(req.params.eleveId);
    if (!eleve)
      return res.status(404).json({ message: "Élève introuvable." });

    // 1️⃣ Récupérer toutes les transactions liées à cet élève
    const transactionsAll = await Transaction.find({
      type: "entree",
      nomEleve: new RegExp(`${eleve.nom}\\s*${eleve.prenom}`, "i"),
    }).sort({ date: 1 });

    // 2️⃣ Liste de mots-clés à exclure
    const motsCleExclus = [
      "ancienne", "ancien", "année passée", "année dernière",
      "2023", "2022", "2021",
      "CEP", "examen", "cantine", "tenue", "certificat", "livre",
      "transport", "fourniture", "restant 2023-2024", "reste", "photocopie"
    ];

    // 3️⃣ Filtrage intelligent
    const transactions = transactionsAll.filter(t => {
      if (!t.motifs) return false;
      const motif = t.motifs.toLowerCase();

      // Exclure si le motif contient un mot-clé non lié à la scolarité
      const estHorsScolarite = motsCleExclus.some(m => motif.includes(m));
      if (estHorsScolarite) return false;

      return true;
    });

    // 💬 Debug utile
    console.log(`Transactions avant filtrage : ${transactionsAll.length}`);
    console.log(`Transactions après filtrage : ${transactions.length}`);

     
    // 4️⃣ Frais de scolarité pour sa classe et son année
    const tarif = await FraisScolarite.findOne({
      classe: eleve.classe,
      anneeScolaire: eleve.anneeScolaire,
    });

    let montantScolarite = tarif ? tarif.montant : 0;

    // 5️⃣ Ajustement : si inscription OU paiement de 3600 → +1000 FCFA une seule fois
    const aPayeInscription = transactions.some(t => {
      if (!t.motifs) return false;
      const motif = t.motifs.toLowerCase();
      // Regex stricte : "inscription" seul, pas "réinscription"
      return /\b(?<!ré)inscription\b/.test(motif);
    });
    const aPaye3600 = transactions.some(t => t.montant === 3600);

    if (aPayeInscription || aPaye3600) {
      montantScolarite += 1200;
      console.log(`+1200 FCFA ajouté pour ${eleve.nom} (${aPayeInscription ? "inscription" : "montant 3600"})`);
    }


    // 6️⃣ Génération du PDF avec le nouveau total
    await generateRelevePDF(res, eleve, transactions, { montant: montantScolarite });

  } catch (err) {
    console.error("Erreur génération relevé :", err);
    res.status(500).json({ message: "Erreur lors de la génération du relevé." });
  }
});




module.exports = router;
