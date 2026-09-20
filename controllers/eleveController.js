const Eleve = require("../models/Eleve");
const { getAnneeActive } = require("../models/Parametre");

// 🔍 Recherche rapide d’élèves
// Par défaut on cherche uniquement dans l'année scolaire active (la caisse, par ex.,
// ne doit trouver que les élèves de l'année en cours). On peut forcer une autre année
// avec ?annee=2024-2025, ou chercher sur toutes les années avec ?annee=toutes.
exports.searchEleves = async (req, res) => {
  try {
    const { q } = req.query; // texte tapé par l’utilisateur

    if (!q || q.trim() === "") {
      return res.json([]); // si vide, on renvoie un tableau vide
    }

    const anneeParam = req.query.annee || (await getAnneeActive());

    const filtre = {
      $or: [
        { nom: new RegExp(q, "i") },
        { prenom: new RegExp(q, "i") }
      ]
    };
    if (anneeParam !== "toutes") {
      filtre.anneeScolaire = anneeParam;
    }

    // On cherche sur nom ou prénom (insensible à la casse), dans l'année choisie
    const eleves = await Eleve.find(filtre)
      .limit(10) // limiter pour la perf
      .select("nom prenom classe matricule anneeScolaire"); // on renvoie que l’essentiel

    return res.json(eleves);
  } catch (err) {
    console.error("Erreur recherche élève:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
