const express = require("express");
const router = express.Router();
const Eleve = require("../models/Eleve");
const User = require("../models/User");
const AgentCaisse = require("../models/AgentCaisse");
const FraisScolarite = require("../models/FraisScolarite");
const protect = require("../middleware/authMiddleware");
const { getAnneeActive } = require("../models/Parametre");

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


// 🔍 Recherche par matricule (le matricule seul ne suffit plus à identifier
// un élève de façon unique depuis qu'il peut se répéter d'une année sur l'autre :
// on cherche donc dans l'année demandée, ou l'année active par défaut).
router.get("/upload/search/:matricule", async (req, res) => {
  try {
    const { matricule } = req.params;
    const anneeScolaire = req.query.annee || (await getAnneeActive());

    const eleve = await Eleve.findOne({ matricule, anneeScolaire });

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

// ➡️ Dupliquer les frais de scolarité d'une année vers une autre (ex: la
// grille tarifaire ne change pas ou change peu d'une rentrée à l'autre).
// Les classes qui ont déjà un frais défini pour l'année cible sont ignorées
// (pas d'écrasement silencieux d'une valeur déjà saisie).
router.post("/frais/dupliquer", async (req, res) => {
  try {
    const { anneeSource, anneeCible } = req.body;
    if (!anneeSource || !anneeCible) {
      return res.status(400).json({ error: "anneeSource et anneeCible sont requis." });
    }
    if (anneeSource === anneeCible) {
      return res.status(400).json({ error: "L'année cible doit être différente de l'année source." });
    }

    const fraisSource = await FraisScolarite.find({ anneeScolaire: anneeSource });
    if (!fraisSource.length) {
      return res.status(404).json({ error: `Aucun frais trouvé pour l'année ${anneeSource}.` });
    }

    const fraisExistantsCible = await FraisScolarite.find({ anneeScolaire: anneeCible }).select("classe");
    const classesDejaDefinies = new Set(fraisExistantsCible.map((f) => f.classe));

    const aCreer = fraisSource.filter((f) => !classesDejaDefinies.has(f.classe));

    if (!aCreer.length) {
      return res.json({
        message: `Toutes les classes ont déjà un frais défini pour ${anneeCible}.`,
        crees: 0,
        ignorees: fraisSource.length,
      });
    }

    const docs = aCreer.map((f) => ({
      classe: f.classe,
      montant: f.montant,
      anneeScolaire: anneeCible,
    }));
    const inserted = await FraisScolarite.insertMany(docs);

    res.status(201).json({
      message: `${inserted.length} classe(s) dupliquée(s) de ${anneeSource} vers ${anneeCible}.`,
      crees: inserted.length,
      ignorees: classesDejaDefinies.size,
      data: inserted,
    });
  } catch (err) {
    console.error("Erreur duplication frais:", err);
    res.status(500).json({ error: "Erreur serveur lors de la duplication." });
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
    const anneeScolaire = req.query.annee || (await getAnneeActive());

    const eleves = await Eleve.find({ classe, anneeScolaire }).sort({ nom: 1, prenom: 1 });
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

/* =========================
   TRANSFERT D'UN ÉLÈVE VERS UNE NOUVELLE ANNÉE SCOLAIRE
   Crée une NOUVELLE fiche élève (nouvelle classe, nouvelle année) en copiant
   les infos personnelles de l'ancienne fiche, et relie les deux via
   eleveAnneePrecedente. L'ancienne fiche n'est jamais modifiée ni supprimée :
   son historique (classe, paiements, certificats) reste intact.
========================= */
router.post("/eleve/:id/transferer", protect, async (req, res) => {
  try {
    const ancienId = req.params.id;
    const { nouvelleClasse, nouvelleAnneeScolaire } = req.body;

    if (!nouvelleClasse) {
      return res.status(400).json({ message: "La nouvelle classe est requise." });
    }

    const ancienEleve = await Eleve.findById(ancienId);
    if (!ancienEleve) {
      return res.status(404).json({ message: "Élève introuvable." });
    }

    const anneeCible = nouvelleAnneeScolaire || (await getAnneeActive());

    if (anneeCible === ancienEleve.anneeScolaire) {
      return res.status(400).json({
        message: "La nouvelle année doit être différente de l'année actuelle de l'élève.",
      });
    }

    // Empêche un double transfert accidentel (double-clic, etc.)
    const dejaTransfere = await Eleve.findOne({
      eleveAnneePrecedente: ancienEleve._id,
      anneeScolaire: anneeCible,
    });
    if (dejaTransfere) {
      return res.status(409).json({
        message: `Cet élève a déjà une fiche pour l'année ${anneeCible}.`,
        data: dejaTransfere,
      });
    }

    const nouvelleFiche = await Eleve.create({
      nom: ancienEleve.nom,
      prenom: ancienEleve.prenom,
      dateNaissance: ancienEleve.dateNaissance,
      lieuNaissance: ancienEleve.lieuNaissance,
      sexe: ancienEleve.sexe,
      contact: ancienEleve.contact,
      matricule: ancienEleve.matricule,
      classe: nouvelleClasse,
      anneeScolaire: anneeCible,
      eleveAnneePrecedente: ancienEleve._id,
    });

    res.status(201).json({
      message: `Élève transféré en ${nouvelleClasse} (${anneeCible}) avec succès.`,
      data: nouvelleFiche,
    });
  } catch (err) {
    console.error("Erreur transfert élève:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Un élève avec ce matricule existe déjà pour cette année scolaire.",
      });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message, errors: err.errors });
    }
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
   TRANSFERT EN MASSE D'UNE CLASSE ENTIÈRE VERS UNE NOUVELLE ANNÉE
   Même logique que le transfert individuel, appliquée à tous les élèves
   d'une classe/année source en une seule opération. Les élèves déjà
   transférés vers l'année cible (transfert précédent, relance après une
   erreur partielle...) sont automatiquement ignorés, pas dupliqués.
========================= */
router.post("/eleves/transferer-classe", protect, async (req, res) => {
  try {
    const { classeSource, anneeSource, classeCible, anneeCible } = req.body;

    if (!classeSource || !anneeSource || !classeCible || !anneeCible) {
      return res.status(400).json({
        message: "classeSource, anneeSource, classeCible et anneeCible sont tous requis.",
      });
    }
    if (anneeSource === anneeCible) {
      return res.status(400).json({
        message: "L'année cible doit être différente de l'année source.",
      });
    }

    const eleves = await Eleve.find({ classe: classeSource, anneeScolaire: anneeSource });
    if (!eleves.length) {
      return res.status(404).json({
        message: `Aucun élève trouvé en ${classeSource} pour l'année ${anneeSource}.`,
      });
    }

    // Ne pas re-transférer ceux qui ont déjà une fiche pour l'année cible
    // (ex: relance après une interruption, ou double-clic)
    const idsSource = eleves.map((e) => e._id);
    const dejaTransferes = await Eleve.find({
      eleveAnneePrecedente: { $in: idsSource },
      anneeScolaire: anneeCible,
    }).select("eleveAnneePrecedente");
    const dejaTransferesSet = new Set(dejaTransferes.map((d) => String(d.eleveAnneePrecedente)));

    const aTransferer = eleves.filter((e) => !dejaTransferesSet.has(String(e._id)));

    if (!aTransferer.length) {
      return res.json({
        message: `Les ${eleves.length} élève(s) de ${classeSource} (${anneeSource}) ont déjà tous une fiche pour ${anneeCible}.`,
        transferes: 0,
        ignores: eleves.length,
        erreurs: [],
      });
    }

    const docs = aTransferer.map((e) => ({
      nom: e.nom,
      prenom: e.prenom,
      dateNaissance: e.dateNaissance,
      lieuNaissance: e.lieuNaissance,
      sexe: e.sexe,
      contact: e.contact,
      matricule: e.matricule,
      classe: classeCible,
      anneeScolaire: anneeCible,
      eleveAnneePrecedente: e._id,
    }));

    let insertedCount = 0;
    let erreurs = [];
    try {
      const inserted = await Eleve.insertMany(docs, { ordered: false });
      insertedCount = inserted.length;
    } catch (bulkErr) {
      // Avec { ordered: false }, Mongo tente d'insérer tous les documents et
      // remonte une erreur globale listant seulement ceux qui ont échoué
      // (ex: conflit de matricule) — les autres sont bien insérés.
      insertedCount = bulkErr.insertedDocs ? bulkErr.insertedDocs.length : 0;
      const writeErrors = bulkErr.writeErrors || (bulkErr.result && bulkErr.result.result && bulkErr.result.result.writeErrors) || [];
      erreurs = writeErrors.map((we) => {
        const doc = docs[we.index];
        return {
          eleve: doc ? `${doc.nom} ${doc.prenom}` : "élève inconnu",
          raison: we.code === 11000 || (we.err && we.err.code === 11000)
            ? "Matricule déjà utilisé pour cette année scolaire"
            : "Erreur de validation",
        };
      });
      if (!writeErrors.length) {
        // Erreur imprévue, pas une simple erreur d'écriture partielle
        throw bulkErr;
      }
    }

    res.status(201).json({
      message: `${insertedCount} élève(s) transféré(s) de ${classeSource} (${anneeSource}) vers ${classeCible} (${anneeCible}).`,
      transferes: insertedCount,
      ignores: dejaTransferesSet.size,
      erreurs,
    });
  } catch (err) {
    console.error("Erreur transfert de classe:", err);
    res.status(500).json({ message: "Erreur serveur lors du transfert en masse." });
  }
});


module.exports = router;
