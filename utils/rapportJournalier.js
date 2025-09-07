const PDFDocument = require("pdfkit");
const path = require("path");

function generateRapportPDF(res, data) {
  const filename = `rapport_journalier_${data.date.replace(/\//g, "-")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 30, size: "A4" });
  doc.pipe(res);

  // === HEADER ===
  const logoPath = path.join(__dirname, "assets/logo.png");
  try {
    doc.image(logoPath, 50, 30, { width: 60 });
    doc.image(logoPath, 500, 30, { width: 60 });
  } catch (e) {
    console.warn("Logo manquant :", e.message);
  }

  doc.fontSize(14).font("Helvetica-Bold")
    .text("Complexe Scolaire Privé « Arche du Millénium » de Comé", 40, 40, { align: "center" });
  doc.fontSize(10).font("Helvetica-Oblique")
    .text("Discipline – Travail – Succès", { align: "center" });

  doc.moveDown(2);
  doc.fontSize(12).font("Helvetica-Bold")
    .text(`RAPPORT JOURNALIER --  ${data.date}`, { align: "center" });

  doc.moveDown(1);
  doc.fontSize(10).font("Helvetica")
    .text(`Chargé de caisse : ${data.caissier}`, 25, doc.y, { continued: true })
    .text(`Solde d’ouverture : ${data.soldeOuverture.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`, { align: "right" });

  doc.moveDown(1);
 // Fonction utilitaire pour dessiner un tableau multi-page
  const drawTable = (headers, rows, startX, startY, colWidths, totalText = null) => {
    let y = startY;
    const rowPadding = 5;
    // === Fonction pour tableau stylisé avec ajustement dynamique ===
    const drawHeader = () => {
      let x = startX;
      const rowHeight = 22;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("black");
      headers.forEach((h, i) => {
        doc.rect(x, y, colWidths[i], rowHeight).fillAndStroke("#e0e0e0", "black");
        doc.fillColor("black").text(h, x + 3, y + 7, { width: colWidths[i] - 6, align: "center" });
        x += colWidths[i];
      });
      y += rowHeight;
    };

    drawHeader();

    // Lignes
    doc.font("Helvetica").fontSize(9).fillColor("black");
    rows.forEach((r, rowIndex) => {
      // Calcul hauteur nécessaire
      let heights = r.map((cell, i) =>
        doc.heightOfString(cell, { width: colWidths[i] - 6 })
      );
      let rowHeight = Math.max(...heights) + rowPadding * 2;

      // Vérifier si la ligne dépasse la page
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 50) {
        doc.addPage();
        y = doc.y;
        drawHeader();
      }

      // Dessiner la ligne
      let x = startX;
      const bgColor = rowIndex % 2 === 0 ? "white" : "#f9f9f9";
      r.forEach((cell, i) => {
        doc.rect(x, y, colWidths[i], rowHeight).fillAndStroke(bgColor, "black");
          // ✅ Si c'est la première colonne (Montant), on met en gras
          if (i === 0) {
            doc.font("Helvetica-Bold");
          } else {
            doc.font("Helvetica");
          }
        doc.fillColor("black").text(cell, x + 3, y + rowPadding, { width: colWidths[i] - 6 });
        x += colWidths[i];
      });
      y += rowHeight;
    });

    // Total en bas du tableau
    if (totalText) {
      if (y + 30 > doc.page.height - doc.page.margins.bottom - 50) {
        doc.addPage();
        y = doc.y;
      }
      doc.font("Helvetica-Bold").fontSize(10).text(totalText, startX, y + 5);
      y += 25;
    }

    return y;
  }


  // === ENTRÉES ===
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fillColor("black").text("Entrées de Caisse", { underline: true });
  doc.moveDown(0.5);

  const entreesRows = data.entrees.map(e => [
    `${e.montant.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`,
    e.reference,
    e.eleve,
    e.motif
  ]);
  const totalEntrees = data.entrees.reduce((s, e) => s + e.montant, 0);

  let y = drawTable(
    ["Montant", "Référence", "Élèves", "Motifs"],
    entreesRows,
    30,
    doc.y,
    [75, 95, 170, 195],
    `Total : ${totalEntrees.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`
  );

  // === SORTIES ===
  doc.moveDown(1.5);
  doc.font("Helvetica-Bold").fillColor("black").text("Sorties de Caisse", 25, doc.y, { underline: true });
  doc.moveDown(0.5);

  const sortiesRows = data.sorties.map(s => [
    `${s.montant.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`,
    s.reference,
    s.categorie,
    s.motif
  ]);
  const totalSorties = data.sorties.reduce((s, e) => s + e.montant, 0);

  y = drawTable(
    ["Montant", "Référence", "Catégories", "Motifs"],
    sortiesRows,
    30,
    doc.y,
    [75, 95, 100, 265],
    `Total : ${totalSorties.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`
  );

  // === RÉSUMÉ FINAL ===
  const soldeNet = totalEntrees - totalSorties;
  const soldeCloture = data.soldeOuverture + soldeNet;

  doc.moveDown(1.5);
  doc.font("Helvetica-Bold").fillColor("black").text("Résumé final", 25, doc.y, { underline: true });
  doc.moveDown(0.5);

  const resumeHeaders = ["Solde d’ouverture", "Solde net de la journée", "Solde de clôture"];
  const resumeRows = [[
    `${data.soldeOuverture.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`,
    `${(soldeNet >= 0 ? "+" : "")}${soldeNet.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`,
    `${soldeCloture.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`
  ]];

  drawTable(resumeHeaders, resumeRows, 50, doc.y, [150, 150, 150]);

  // === TEXTE DE CERTIFICATION ===
  doc.moveDown(1.5);
  doc.font("Helvetica-Oblique").fontSize(10).fillColor("black").text("Certifié exact, sincère et conforme aux mouvements de caisse enregistrés en ce jour, pour servir et valoir ce que de droit", 30, doc.y, { align: "left" });

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(10).text(`Fait à Comé, le ${data.date}`, { align: "right" });

  // === SIGNATURES ===
  doc.moveDown(2);
  doc.font("Helvetica").fontSize(10);
  doc.text("Le Fondé", 80).text("Le Secrétaire Comptable", 400);

  doc.moveDown(4);
  doc.font("Helvetica-Bold").text(data.fonde, 80).text(data.caissier, 400);

  doc.end();
}

module.exports = generateRapportPDF;
