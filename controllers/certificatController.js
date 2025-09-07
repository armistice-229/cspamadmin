const Certificat = require('../models/certificatModel');
const { generateCertificatBuffer } = require('../utils/pdfCertificat');

// Fonction utilitaire pour formater une date en JJ/MM/AAAA
    function formatDateFR(dateString) {
      if (!dateString) return "";

      // Si la date est au format JJ/MM/AAAA
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
        return dateString; // elle est déjà correcte
      }

      // Sinon on tente en tant qu'objet Date
      const date = new Date(dateString);
      if (isNaN(date)) return "";

      const jour = String(date.getDate()).padStart(2, "0");
      const mois = String(date.getMonth() + 1).padStart(2, "0");
      const annee = date.getFullYear();
      return `${jour}/${mois}/${annee}`;
    }

// Fonction utilitaire pour générer un code alphanumérique
    function generateAlphaNumeric(length = 10) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

// Route pour créer un certificat
exports.createCertificat = async (req, res) => {
  try {
    const data = req.body;

    // ✅ Génération et vérification unicité
    let numeroCertificat;
    let exists = true;
    while (exists) {
      numeroCertificat = generateAlphaNumeric(10);
      const existing = await Certificat.findOne({ numeroCertificat });
      if (!existing) exists = false;
    }
    data.numeroCertificat = numeroCertificat;


    // ✅ Reformater les dates
    data.dateNaissance = formatDateFR(data.dateNaissance);
    data.dateFirstInscription = formatDateFR(data.dateInscription);
    data.dateDelivrance = formatDateFR(new Date()); // aujourd'hui

    let pdfBuffer;

    // ✅ Ajout auto de la date de délivrance (aujourd'hui)
    const today = new Date();
    const formattedDate = today.toLocaleDateString("fr-FR"); // format JJ/MM/AAAA
    data.dateDelivrance = formattedDate;

    
    // Génération PDF avec PDFKit
    
    pdfBuffer = await generateCertificatBuffer(data);

    // Sauvegarde en DB (Trace du certificat pour l'historique)
    const newCertificat = new Certificat({
      numeroCertificat,
      nomEleve: data.nom,
      classe: data.classe,
      matricule: data.matricule,
      dateFirstInscription: data.dateInscription,
      dateDelivrance: data.dateDelivrance,
    });
    await newCertificat.save();

    // Envoi du PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=certificat_${numeroCertificat}.pdf`);
    res.send(pdfBuffer);


  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la génération du certificat" });
  }
};

