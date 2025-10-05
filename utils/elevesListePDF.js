const PDFDocument = require("pdfkit");
const path = require("path");

// 🔹 Formate une date JJ/MM/AAAA proprement
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // si c’est une chaîne du style "12/05/2021", on la garde telle quelle
    return dateStr;
  }
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Génère le PDF de la liste alphabétique des élèves pour une classe donnée.
 * @param {Object} res - Réponse Express
 * @param {Array} eleves - Liste d’élèves
 * @param {String} classe - Nom de la classe
 * @param {String} anneeScolaire - Année scolaire
 */
function genererListePDF(res, eleves, classe, anneeScolaire) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=liste_${classe}.pdf`);
  doc.pipe(res);

  // --- ENTÊTE ---
  const logoPath = path.join(__dirname, "assets/logo.png");
  try {
    doc.image(logoPath, 50, 30, { width: 60 });
    doc.image(logoPath, 500, 30, { width: 60 });
  } catch (e) {
    console.warn("Logo manquant :", e.message);
  }

  doc.font("Times-Roman").fontSize(12)
    .text("Complexe Scolaire Privé Arche du Millénium (CSPAM) de Comé", { align: "center" });
  doc.moveDown(0.1).fontSize(10).text("Travail – Discipline – Succès", { align: "center" });
  doc.moveDown(0.5).text(`Année Scolaire : 2025-2026`, { align: "center" });
  doc.moveDown(1.2).font("Times-Bold").fontSize(14)
    .text("LISTE ALPHABÉTIQUE DES ÉLÈVES", { align: "center" });
  doc.moveDown(1);
  doc.font("Times-Roman").fontSize(12).text(`Classe : ${classe}`, 50, doc.y);

  // --- TABLEAU ---
  const startX = 50;
  let cursorY = doc.y + 10;
  const tableWidth = 500;
  const colWidths = { n: 30, nom: 110, prenom: 130, sexe: 40, date: 90, lieu: 100 };
  const rowMinHeight = 25;

  // 🔹 Helper pour cellules centrées
  function drawCell(x, y, width, height, text, options = {}) {
    const { align = "center", valign = "middle", font = "Times-Roman", fontSize = 9 } = options;
    doc.font(font).fontSize(fontSize);
    doc.rect(x, y, width, height).stroke();

    const textHeight = doc.heightOfString(text, { width: width - 6, align });
    let textY = y + 3;
    if (valign === "middle") textY = y + (height - textHeight) / 2;

    doc.text(text, x + 3, textY, { width: width - 6, align });
  }

  // --- En-têtes ---
  const headers = [
    { text: "N°", width: colWidths.n },
    { text: "NOM", width: colWidths.nom },
    { text: "PRENOM(S)", width: colWidths.prenom },
    { text: "SEXE", width: colWidths.sexe },
    { text: "DATE DE NAISSANCE", width: colWidths.date },
    { text: "LIEU DE NAISSANCE", width: colWidths.lieu }
  ];

  const headerHeights = headers.map(h =>
    doc.heightOfString(h.text, { width: h.width - 6, align: "center" }) + 6
  );
  const headerHeight = Math.max(...headerHeights, rowMinHeight);

  doc.lineWidth(0.5);
  doc.rect(startX, cursorY, tableWidth, headerHeight).fillAndStroke("#f3f3f3", "#000");
  doc.fillColor("#000").font("Times-Bold").fontSize(9);

  let headerX = startX;
  headers.forEach(h => {
    drawCell(headerX, cursorY, h.width, headerHeight, h.text, {
      align: "center",
      font: "Times-Bold",
      fontSize: 9
    });
    headerX += h.width;
  });
  cursorY += headerHeight;
  doc.fillColor("#000");

  // --- Contenu ---
  let i = 1;
  for (const e of eleves) {
    const row = [
      { text: String(i), width: colWidths.n },
      { text: (e.nom || "").toUpperCase(), width: colWidths.nom },
      { text: e.prenom || "", width: colWidths.prenom },
      { text: e.sexe || "", width: colWidths.sexe },
      { text: formatDate(e.dateNaissance), width: colWidths.date },
      { text: e.lieuNaissance || "", width: colWidths.lieu }
    ];

    const heights = row.map(c => doc.heightOfString(c.text, { width: c.width - 6, align: "center" }) + 6);
    const actualHeight = Math.max(...heights, rowMinHeight);

    // Vérifie si on a assez d’espace avant d’ajouter une nouvelle ligne
    if (cursorY + actualHeight > doc.page.height - 80) {
      addFooter(doc);
      doc.addPage();
      cursorY = 50;
    }

    // Dessine la ligne
    let x = startX;
    for (let j = 0; j < row.length; j++) {
      drawCell(x, cursorY, row[j].width, actualHeight, row[j].text, {
        align: "center",
        valign: "middle",
        fontSize: 9
      });
      x += row[j].width;
    }

    cursorY += actualHeight;
    i++;
  }

  // --- PIED DE PAGE FINAL ---
  addFooter(doc);
  doc.end();
}

/**
 * Ajoute un pied de page stylé sur la page courante
 */
function addFooter(doc) {
  const now = new Date();
  const date = now.toLocaleDateString("fr-FR");
  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  doc.fontSize(8)
    .fillColor("#666")
    .font("Times-Italic")
    .text(`Généré sur AcademyFlow à ${date} ${time}`, {
      align: "center",
      width: doc.page.width - 80
    });
}

module.exports = genererListePDF;
