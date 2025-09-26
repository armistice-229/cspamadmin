const express = require("express");
const router = express.Router();
const Eleve = require("../models/Eleve");
const FraisScolarite = require("../models/FraisScolarite");
const Transaction = require("../models/OperationCaisse");
const protect = require("../middleware/authMiddleware");

//Tous les routes protégées
router.use(protect);

router.get("/progress", async (req, res) => {
  try {
    const anneeScolaire = req.query.annee || "2024-2025"; // par défaut

    // 1️⃣ Récupérer les frais par classe
    const frais = await FraisScolarite.find({ anneeScolaire });

    // 2️⃣ Compter les élèves par classe
    const eleves = await Eleve.find({ anneeScolaire });

    let montantAttendu = 0;
    frais.forEach(f => {
      const nbElevesClasse = eleves.filter(e => e.classe === f.classe).length;
      montantAttendu += nbElevesClasse * f.montant;
    });

    // 3️⃣ Total encaissé (transactions "entree")
    const transactions = await Transaction.aggregate([
      { $match: { type: "entree" } },
      { $group: { _id: null, total: { $sum: "$montant" } } }
    ]);
    const montantEncaisse = transactions.length > 0 ? transactions[0].total : 0;

    // 4️⃣ Calcul du taux
    const taux = montantAttendu > 0 ? (montantEncaisse / montantAttendu) * 100 : 0;

    res.json({
      anneeScolaire,
      montantAttendu,
      montantEncaisse,
      taux: Number(taux.toFixed(2)) // arrondi à 2 décimales
    });
  } catch (error) {
    console.error("Erreur calcul progress:", error);
    res.status(500).json({ error: "Erreur calcul progress" });
  }
});


//Statistiques cartes
 
router.get("/stats", async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0]; // ex: "2025-09-06"

    // 1️⃣ Revenus du jour (entrées uniquement aujourd’hui)
    const revenusAgg = await Transaction.aggregate([
      {
        $match: {
          type: "entree",
          $expr: {
            $eq: [
              { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              todayStr
            ]
          }
        }
      },
      { $group: { _id: null, total: { $sum: "$montant" } } }
    ]);
    const revenusJour = revenusAgg[0]?.total || 0;

    // 2️⃣ Dépenses du jour (sorties uniquement aujourd’hui)
    const depensesAgg = await Transaction.aggregate([
      {
        $match: {
          type: "sortie",
          $expr: {
            $eq: [
              { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              todayStr
            ]
          }
        }
      },
      { $group: { _id: null, total: { $sum: "$montant" } } }
    ]);
    const depensesJour = depensesAgg[0]?.total || 0;

    // 3️⃣ Solde total (visible uniquement si rôle autorisé)
    let solde = null;
    if (["admin", "directeur"].includes(req.user.role)) {
      const soldeAgg = await Transaction.aggregate([
        {
          $group: {
            _id: "$type",
            total: { $sum: "$montant" }
          }
        }
      ]);

      const totalEntrees =
        soldeAgg.find(s => s._id === "entree")?.total || 0;
      const totalSorties =
        soldeAgg.find(s => s._id === "sortie")?.total || 0;

      solde = totalEntrees - totalSorties;
    }

    // 4️⃣ Réponse JSON
    res.json({
      solde,        // null si l’utilisateur n’a pas le droit
      revenusJour,
      depensesJour
    });
  } catch (error) {
    console.error("Erreur calcul stats:", error);
    res.status(500).json({ error: "Erreur calcul stats" });
  }
});

// GET /api/stats-caisse
router.get("/stats-caisse", async (req, res) => {
  try {
    // 1. Revenus (entrees) et Dépenses (sorties) groupés par jour
    const revenusVsRecettes = await Transaction.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          revenus: {
            $sum: { $cond: [{ $eq: ["$type", "entree"] }, "$montant", 0] }
          },
          recettes: {
            $sum: { $cond: [{ $eq: ["$type", "sortie"] }, "$montant", 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 2. Dépenses par catégorie
    const depensesCategories = await Transaction.aggregate([
      { $match: { type: "sortie" } },
      {
        $group: {
          _id: "$categorie",
          montant: { $sum: "$montant" }
        }
      },
      {
        $project: {
          _id: 0,
          categorie: "$_id",
          montant: 1
        }
      }
    ]);

    const result = {
      revenusVsRecettes: revenusVsRecettes.map(r => ({
        date: r._id,
        revenus: r.revenus,
        recettes: r.recettes
      })),
      depensesCategories
      
    };

    res.json(result);
  } catch (error) {
    console.error("Erreur stats-caisse:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Effectifs par classe (année scolaire en cours)
router.get("/effectifs", async (req, res) => {
  try {
    const { annee } = req.query; // possibilité de filtrer une année précise
    const filtre = annee ? { anneeScolaire: annee } : {};

    // Regrouper par classe et compter
    const effectifs = await Eleve.aggregate([
      { $match: filtre },
      { $group: { _id: "$classe", count: { $sum: 1 } } },
      { $sort: { _id: 1 } } // tri alphabétique des classes
    ]);

    // Formater pour le front
    const result = effectifs.map(item => ({
      classe: item._id,
      count: item.count,
    }));

    res.json({ effectifs: result });
  } catch (error) {
    console.error("Erreur récupération effectifs:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
