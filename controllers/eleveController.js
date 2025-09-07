const Eleve = require("../models/Eleve");

// 🔍 Recherche rapide d’élèves
exports.searchEleves = async (req, res) => {
  try {
    const { q } = req.query; // texte tapé par l’utilisateur

    if (!q || q.trim() === "") {
      return res.json([]); // si vide, on renvoie un tableau vide
    }

    // On cherche sur nom ou prénom (insensible à la casse)
    const eleves = await Eleve.find({
      $or: [
        { nom: new RegExp(q, "i") },
        { prenom: new RegExp(q, "i") }
      ]
    })
      .limit(10) // limiter pour la perf
      .select("nom prenom classe matricule anneeScolaire"); // on renvoie que l’essentiel

    return res.json(eleves);
  } catch (err) {
    console.error("Erreur recherche élève:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
