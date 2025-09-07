const express = require("express");
const router = express.Router();
const {searchEleves} = require("../controllers/eleveController");
const protect = require("../middleware/authMiddleware");
const Eleve = require("../models/Eleve")
const Transaction = require("../models/OperationCaisse");
const FraisScolarite = require("../models/FraisScolarite");

// Toutes les routes sont protégées
router.use(protect);

// Route recherche
router.get("/search", searchEleves);

// ✅ Récupérer les élèves d’une classe donnée
router.get("/classe/:classe", async (req, res) => {
  try {
    const { classe } = req.params;
    const eleves = await Eleve.find({ classe }).sort({ nom: 1, prenom: 1 });

    res.json(eleves);
  } catch (err) {
    console.error("Erreur get élèves par classe:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Récupérer le relevé d'un élève par son ID
router.get("/:eleveId", async (req, res) => {
  try {
    const { eleveId } = req.params;

    // ⚡ Récupérer l'élève
    const eleve = await Eleve.findById(eleveId);
    if (!eleve) {
      return res.status(404).json({ error: "Élève introuvable" });
    }

    // ⚡ Récupérer les frais de scolarité liés à la classe de l'élève
    const frais = await FraisScolarite.findOne({ classe: eleve.classe });
    if (!frais) {
      return res.status(404).json({ error: "Aucun frais trouvé pour cette classe" });
    }

    // ⚡ Récupérer toutes les transactions de type "entree" (paiements)
    const paiements = await Transaction.find({ eleve: eleveId, type: "entree" })
      .sort({ date: 1 })
      .select("date montant -_id"); // Ne prendre que date et montant

    // Montant payé
    const totalPaye = paiements.reduce((sum, t) => sum + t.montant, 0);

    res.json({
      eleve: {
        nom: eleve.nom,
        prenom: eleve.prenom,
        classe: eleve.classe,
      },
      paiements, // tableau [{date, montant}]
      totalPaye,
      montantTotal: frais.montant, // récupéré depuis FraisScolarité
    });
  } catch (err) {
    console.error("Erreur relevé élève:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


module.exports = router;
