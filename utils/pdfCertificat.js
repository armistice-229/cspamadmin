const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

async function generateCertificatBuffer(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const pageWidth = doc.page.width;
      const contentX = 50;
      const contentW = pageWidth - 100;

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      //page dimensions
      const pageHeight = doc.page.height;

      // --- LOGO EN FILIGRANE (fond centré) ---
      const logoPath = "utils/assets/logo.png"; // mets ici le vrai chemin vers le logo
      const logoWidth = 300;
      const logoHeight = 300;
      const centerX = (pageWidth - logoWidth) / 2;
      const centerY = (pageHeight - logoHeight) / 2;

      doc.opacity(0.2); // rendre le logo transparent
      doc.image(logoPath, centerX, centerY, { width: logoWidth, height: logoHeight });
      doc.opacity(1); // remettre normal pour le reste

// Remettre la couleur par défaut du texte
doc.fillColor('black');

      // --- HEADER (centré, comme sur le modèle) ---
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('black')
        .text('REPUBLIQUE DU BENIN', contentX, 60, { width: contentW, align: 'center' })
        .text('******', { align: 'center' })
        .text('MINISTERE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE (MEMP)', { align: 'center' })
        .text('*************', { align: 'center' })
        .text('DIRECTION DEPARTEMENTALE DES ENSEIGNEMENTS MATERNELS ET PRIMAIRES DU MONO', { align: 'center' })
        
        .text('*******************', { align: 'center' })
        .text('CIRCONSCRIPTION SCOLAIRE DE COME', { align: 'center' });


      // --- TITRE (rouge, gras, CENTRÉ sur toute la page) ---
      doc.font('Helvetica-Bold')
        .fontSize(26)
        .fillColor('red')
        .text('CERTIFICAT DE SCOLARITE', contentX, 170, { width: contentW, align: 'center' , underline: true});

      // --- N° DU CERTIFICAT (juste sous le titre, centré) ---
      doc.font('Helvetica-Oblique')
        .fontSize(12)
        .fillColor('black')
        .text(`N° : ${data.numeroCertificat}`, contentX, doc.y + 4, { width: contentW, align: 'center', underline:false });

      // Reset style pour le corps
      doc.moveDown(2);
      doc.font('Helvetica').fontSize(12).fillColor('black');

      // ✅ TEXTE PRINCIPAL : démarre à x=60, y=doc.y (juste sous la zone 3),
    // avec largeur fixe et interligne (lineGap)
    doc.text("             Je soussignée ", 60, doc.y, { align: "left", lineGap: 7, continued: true })
      .font("Helvetica-BoldOblique").text('DANSOU Mawoussé Esther', { continued: true })
      .font("Helvetica").text(`, Directrice de l’école primaire privée`, { continued: true })
      .font("Helvetica-BoldOblique").text('Arche du Millénium de Comé', { continued: true })
      .font("Helvetica").text(", certifie que l’élève ", { continued: true })
      .font("Helvetica-BoldOblique").text(data.nom, { continued: true })
      .font("Helvetica").text(", né(e) le ", { continued: true })
      .font("Helvetica-BoldOblique").text(data.dateNaissance, { continued: true })
      .font("Helvetica").text(" à ", { continued: true })
      .font("Helvetica-BoldOblique").text(data.lieuNaissance, { continued: true })
      .font("Helvetica").text(" est régulièrement inscrit(e) dans mon établissement sous le numéro matricule ", { continued: true })
      .font("Helvetica-BoldOblique").text(data.matricule, { continued: true })
      .font("Helvetica").text(" depuis le ", { continued: true })
      .font("Helvetica-BoldOblique").text(data.dateFirstInscription, { continued: true })
      .font("Helvetica").text("  et poursuit actuellement ses études en classe de ", { continued: true })
      .font("Helvetica-BoldOblique").text(data.classe, { continued: true })
      .font("Helvetica").text(", avec les appréciations suivantes :");
      doc.moveDown(2);

      // Appréciations
      doc.font("Helvetica-Bold").text("                           Assiduité : ", { underline: false, continued: true , lineGap: 8});
      doc.font("Helvetica").text(`${data.assiduite || "  ………………………………………………"}` , { underline: false });
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").text("                           Conduite : ", { underline: false, continued: true , lineGap: 8 });
      doc.font("Helvetica").text(`${data.conduite || "  ………………………………………………"}`, { underline: false });
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").text("                           Travail   : ", { underline: false, continued: true , lineGap: 8 });
      doc.font("Helvetica").text(`${data.travail || "  ………………………………………………"}`, { underline: false });
      doc.moveDown(2);

      // Observations particulières
      doc.font("Helvetica-Bold").text("Observations particulières / Décision :", { underline: true , lineGap: 8 });
      doc.moveDown(0.5);
      if (data.observations) {
        // Vérifie le contenu pour définir la couleur
        if (data.observations.includes("Passe")) {
            doc.font("Helvetica-Bold").fillColor('green');
        } else if (data.observations.includes("Redouble")) {
            doc.font("Helvetica-Bold").fillColor('red');
        } else {
            doc.fillColor('black'); // couleur par défaut si aucun mot trouvé
        }
        doc.font("Helvetica").text(data.observations);
      } else {
        doc.font("Helvetica").text("…………………………………………………………………………………………………………", { lineGap: 8 });
        doc.moveDown(0.5);
        doc.text("…………………………………………………………………………………………………………", { lineGap: 8 });
        doc.moveDown(0.5);
        doc.text("…………………………………………………………………………………………………………", { lineGap: 8 });
      }
      doc.moveDown(3);

      // --- Date + Signature (à droite) & QR Code (à gauche, même ligne) ---

      // Position verticale de la ligne finale
      const finalY = 670;  

      // Date et lieu (au-dessus de la signature, toujours à droite)
      doc.font("Helvetica")
        .fillColor('black')
        .text(`Fait à Comé, le ${data.dateDelivrance}`, 0, finalY - 40, {
          align: "right",
          width: doc.page.width - 100
        });

      // "Le Directeur/Directrice"
      doc.text(`La Directrice`, 0, finalY - 10, {
        align: "right",
        width: doc.page.width - 100,
        continued: true
      })

      // Nom du Directeur souligné
      doc.font("Helvetica-Bold")
        .text("DANSOU Mawoussé Esther", 0, finalY + 50, {
          align: "right",
          width: doc.page.width - 100,
          underline: true
        });

      // QR Code aligné à gauche sur la même ligne
      const qrImage = await QRCode.toDataURL(`https://scoly.onrender.com/verify.html?numero=${data.numeroCertificat}`);

      doc.image(Buffer.from(qrImage.split(",")[1], "base64"), 60, finalY - 40, {
        fit: [100, 100]
      });

      //Fin du document
      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCertificatBuffer };
