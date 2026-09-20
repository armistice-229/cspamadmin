// utils/generateRelevePDF.js
const PDFDocument = require("pdfkit");
const path = require("path");
const QRCode = require("qrcode"); // ✅ FIX: require déplacé en haut du fichier

// ─────────────────────────────────────────────
// HELPER : drawTable
// Dessine un tableau complet avec en-tête, lignes alternées,
// ligne de total, traits propres et saut de page automatique.
// ─────────────────────────────────────────────
function drawTable(doc, { headers, colWidths, rows, tableLeft, startY, rowHeight = 25 }) {
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const PAGE_BOTTOM = doc.page.height - doc.page.margins.bottom - 60; // marge de sécurité

  // ── Dessin d'une seule ligne (fond + texte + traits verticaux)
  function drawRow(y, cells, { bg = null, bold = false, height = rowHeight } = {}) {
    // Saut de page si nécessaire
    if (y + height > PAGE_BOTTOM) {
      doc.addPage();
      y = doc.page.margins.top;
      // Redessiner l'en-tête sur la nouvelle page
      drawHeaderRow(y);
      y += rowHeight;
    }

    // Fond de la ligne
    if (bg) {
      doc.rect(tableLeft, y, tableWidth, height).fillAndStroke(bg, "black");
    } else {
      doc.rect(tableLeft, y, tableWidth, height).stroke();
    }

    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(10)
      .fillColor("black");

    let x = tableLeft;
    cells.forEach((cell, i) => {
      const opts = { width: colWidths[i] - 10, align: cell.align || "left" };
      const textX = cell.align === "right" ? x - 5 : x + 5;
      doc.text(cell.text, textX, y + 7, opts);
      x += colWidths[i];
    });

    // Traits verticaux
    let xx = tableLeft;
    colWidths.forEach((w) => {
      doc.moveTo(xx, y).lineTo(xx, y + height).stroke("black");
      xx += w;
    });
    doc.moveTo(tableLeft + tableWidth, y).lineTo(tableLeft + tableWidth, y + height).stroke("black");

    return y + height;
  }

  // ── En-tête du tableau
  function drawHeaderRow(y) {
    doc.rect(tableLeft, y, tableWidth, rowHeight).fillAndStroke("#d0e4f7", "black");
    doc.font("Helvetica-Bold").fontSize(10).fillColor("black");
    let x = tableLeft;
    headers.forEach((h, i) => {
      doc.text(h, x + 5, y + 7, { width: colWidths[i] - 10, align: "left" });
      x += colWidths[i];
    });
    let xx = tableLeft;
    colWidths.forEach((w) => {
      doc.moveTo(xx, y).lineTo(xx, y + rowHeight).stroke("black");
      xx += w;
    });
    doc.moveTo(tableLeft + tableWidth, y).lineTo(tableLeft + tableWidth, y + rowHeight).stroke("black");
  }

  let y = startY;

  // En-tête
  drawHeaderRow(y);
  y += rowHeight;

  // Lignes de données avec couleurs alternées
  rows.forEach((cells, index) => {
    // Calcul de la hauteur dynamique pour cette ligne
    const cellHeights = cells.map((cell, i) =>
      doc.heightOfString(cell.text, { width: colWidths[i] - 10 })
    );
    const dynamicHeight = Math.max(rowHeight, ...cellHeights) + 10;

    const bg = index % 2 === 0 ? null : "#f5f9ff"; // ✅ Alternance blanc / bleu très clair
    y = drawRow(y, cells, { bg, height: dynamicHeight });
  });

  return y; // retourne la position Y finale
}

// ─────────────────────────────────────────────
// HELPER : addPageNumbers
// Ajoute "Page X / N" sur toutes les pages en pied de page
// ─────────────────────────────────────────────
function addPageNumbers(doc) {
  const totalPages = doc.bufferedPageRange().count;
  const startPage = doc.bufferedPageRange().start;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(startPage + i);
    doc
      .fontSize(9)
      .fillColor("gray")
      .text(
        `Page ${i + 1} / ${totalPages}`,
        0,
        doc.page.height - doc.page.margins.bottom - 20,
        { align: "center", width: doc.page.width }
      );
  }
}

// ─────────────────────────────────────────────
// HELPER : drawWatermarkSolde
// Dessine un filigrane diagonal vert "SOLDÉ" centré
// sur le cadre "Situation du compte" quand reste === 0.
// boxX, boxY  : coin supérieur gauche du cadre
// boxW, boxH  : dimensions du cadre
// ─────────────────────────────────────────────
function drawWatermarkSolde(doc, boxX, boxY, boxW, boxH) {
  doc.save();

  // Clipper au rectangle du cadre pour que le filigrane
  // ne déborde pas sur le reste du document
  doc.rect(boxX, boxY, boxW, boxH).clip();

  // Centre du cadre
  const cx = boxX + boxW / 2;
  const cy = boxY + boxH / 2;

  // Rotation -30° autour du centre
  doc.translate(cx, cy).rotate(-30, { origin: [0, 0] });

  // Texte principal "SOLDÉ"
  doc
    .font("Helvetica-Bold")
    .fontSize(52)
    .fillColor("#1a7a1a")
    .fillOpacity(0.15)
    .text("SOLDÉ", -80, -28, { lineBreak: false });

  // Bordure rectangulaire autour du texte (style cachet)
  doc
    .rect(-92, -36, 178, 58)
    .lineWidth(3)
    .strokeColor("#1a7a1a")
    .strokeOpacity(0.15)
    .stroke();

  // Réinitialiser opacité et transformation
  doc.restore();
  doc.fillOpacity(1).strokeOpacity(1).lineWidth(1);
}

// ─────────────────────────────────────────────
// FONCTION PRINCIPALE
// ─────────────────────────────────────────────
async function generateRelevePDF(res, eleve, transactions, tarif) {
  const totalScolarite = tarif ? tarif.montant : 0;
  const totalPaye = transactions.reduce((sum, t) => sum + t.montant, 0);
  const reste = totalScolarite - totalPaye;

  // ✅ FIX: bufferPages: true pour pouvoir ajouter les numéros de page après coup
  const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=releve_${eleve.nom}_${eleve.prenom}.pdf`
  );

  // ✅ FIX: try/finally pour garantir doc.end() même en cas d'erreur
  doc.pipe(res);
  let docEnded = false;

  try {
    // ═══════════════════════════════════
    // HEADER
    // ═══════════════════════════════════
    const logoPath = path.join(__dirname, "assets/logo.png");
    try {
      doc.image(logoPath, 40, 30, { width: 60 });
      doc.image(logoPath, 500, 30, { width: 60 });
    } catch (e) {
      console.warn("Logo manquant :", e.message);
    }

    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(
        "Complexe Scolaire Privé Arche du Millénium (CSPAM) de Comé",
        40, 40,
        { align: "center" }
      )
      .moveDown(0.3)
      .fontSize(10)
      .font("Helvetica")
      .text("Travail – Discipline – Succès", { align: "center" })
      .moveDown(0.3)
      .font("Helvetica-Bold")
      .text("Année Scolaire : 2025-2026", { align: "center" });

    doc.moveDown(2);

    // TITRE
    doc
      .fontSize(14)
      .fillColor("black")
      .font("Helvetica-Bold")
      .text("RELEVE DE COMPTE SCOLARITE", { align: "center", underline: true })
      .moveDown(1.5);

    // INFOS ÉLÈVE
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(
        `Nom de l'élève : ${eleve.nom.toUpperCase()} ${eleve.prenom}, ${eleve.classe}`,
        { align: "left" }
      );

    doc.moveDown(1.2);

    // ═══════════════════════════════════
    // TABLEAU DES PAIEMENTS via drawTable()
    // ═══════════════════════════════════
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("Détail des paiements", { underline: true })
      .moveDown(0.5);

    const tableLeft = 40;
    const colWidths = [40, 110, 80, 210, 80];
    const headers = ["N°", "Références", "Date", "Description", "Montant versé"];

    const rows = transactions.map((t, index) => [
      { text: String(index + 1) },
      { text: t.reference || "-" }, // ✅ FIX: valeur par défaut si undefined
      { text: new Date(t.date).toLocaleDateString("fr-FR") },
      { text: t.motifs || "-" },
      {
        text: `${Number(t.montant).toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`,
        align: "right",
      },
    ]);

    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const startY = doc.y + 10;

    let finalY = drawTable(doc, {
      headers,
      colWidths,
      rows,
      tableLeft,
      startY,
    });

    // Ligne Total
    const totalRowHeight = 25;
    doc
      .rect(tableLeft, finalY, tableWidth, totalRowHeight)
      .fillAndStroke("#d0e4f7", "black");
    doc.font("Helvetica-Bold").fillColor("black");
    doc.text(
      "Total",
      tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5,
      finalY + 7,
      { width: colWidths[3] - 10 }
    );
    doc.text(
      `${Number(totalPaye).toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`,
      tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 5,
      finalY + 7,
      { width: colWidths[4], align: "right" }
    );
    // Traits verticaux ligne total
    let xx = tableLeft;
    colWidths.forEach((w) => {
      doc.moveTo(xx, finalY).lineTo(xx, finalY + totalRowHeight).stroke("black");
      xx += w;
    });
    doc
      .moveTo(tableLeft + tableWidth, finalY)
      .lineTo(tableLeft + tableWidth, finalY + totalRowHeight)
      .stroke("black");

    finalY += totalRowHeight + 20;

    // ✅ FIX: Repositionnement propre du curseur Y après le tableau
    doc.x = 40;
    doc.y = finalY;

    // ═══════════════════════════════════
    // SITUATION DU COMPTE (design amélioré)
    // ═══════════════════════════════════
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#1a4e8a")
      .text("Situation du compte", { underline: false })
      .moveDown(0.5);

    const boxX = 40;
    let boxY = doc.y;
    const boxW = 420;
    const lineH = 28;

    // Ligne 1 — Montant total
    doc.rect(boxX, boxY, boxW, lineH).fillAndStroke("#e8f4fd", "black");
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a4e8a")
       .text("Montant total de scolarité (+ Frais obligatoires)", boxX + 10, boxY + 8);
    doc.fillColor("#1a4e8a")
       .text(
         `${totalScolarite.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`,
         boxX + 10, boxY + 8,
         { width: boxW - 20, align: "right" }
       );
    boxY += lineH;

    // Ligne 2 — Total payé (fond vert clair)
    doc.rect(boxX, boxY, boxW, lineH).fillAndStroke("#eafbea", "black");
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a7a1a")
       .text("Total déjà payé", boxX + 10, boxY + 8);
    doc.fillColor("#1a7a1a")
       .text(
         `${totalPaye.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`,
         boxX + 10, boxY + 8,
         { width: boxW - 20, align: "right" }
       );
    boxY += lineH;

    // Ligne 3 — Reste à payer (fond rouge clair si reste > 0)
    const resteBg = reste > 0 ? "#fff0f0" : "#eafbea";
    const resteColor = reste > 0 ? "#c0392b" : "#1a7a1a";
    doc.rect(boxX, boxY, boxW, lineH).fillAndStroke(resteBg, "black");
    doc.font("Helvetica-Bold").fontSize(10).fillColor(resteColor)
       .text("Reste à payer", boxX + 10, boxY + 8);
    doc.fillColor(resteColor)
       .text(
         `${reste.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`,
         boxX + 10, boxY + 8,
         { width: boxW - 20, align: "right" }
       );
    boxY += lineH + 10;

    // ✅ Filigrane "SOLDÉ" diagonal vert si le compte est soldé
    if (reste === 0) {
      const cadreTopY = boxY - lineH * 3 - 10;
      const cadreH = lineH * 3;
      drawWatermarkSolde(doc, boxX, cadreTopY, boxW, cadreH);
    }

    doc.x = 40;
    doc.y = boxY + 10;

    // ═══════════════════════════════════
    // SIGNATURE + QR CODE + TAMPON
    // ═══════════════════════════════════
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("black")
      .text("La Direction", { align: "right" });

    doc.moveDown(1.5);
    let posY = doc.y;

    try {
      const qrData = await QRCode.toDataURL(
        `Relevé de compte - ${eleve.nom} ${eleve.prenom} - ${new Date().toLocaleDateString("fr-FR")}`
      );
      const qrBuffer = Buffer.from(
        qrData.replace(/^data:image\/png;base64,/, ""),
        "base64"
      );
      doc.image(qrBuffer, 60, posY, { width: 80 });

      const stampPath = path.join(__dirname, "assets/stamp.png");
      doc.image(stampPath, 380, posY - 10, { width: 120 });
    } catch (e) {
      console.warn("Erreur génération QR ou tampon :", e.message);
    }

    // ═══════════════════════════════════
    // PIED DE PAGE : date + heure
    // ═══════════════════════════════════
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR");
    const timeStr = now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // La date/heure est ajoutée sur toutes les pages via la boucle ci-dessous
    // après flushPages (voir addPageNumbers)

    // ═══════════════════════════════════
    // NUMÉROS DE PAGE (après bufferPages)
    // ═══════════════════════════════════
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);

      // Numéro de page
      doc
        .fontSize(9)
        .fillColor("gray")
        .text(
          `Page ${i + 1} / ${totalPages}`,
          0,
          doc.page.height - doc.page.margins.bottom - 30,
          { align: "center", width: doc.page.width }
        );

      // Date de génération
      doc
        .fontSize(9)
        .fillColor("gray")
        .text(
          `Généré sur AcademyFlow le ${dateStr} à ${timeStr}`,
          50,
          doc.page.height - doc.page.margins.bottom - 15,
          { align: "center", width: doc.page.width - 100 }
        );
    }

    docEnded = true;
    doc.end();

  } catch (err) {
    console.error("Erreur génération PDF :", err);
    // ✅ FIX: s'assurer que doc.end() est appelé même en cas d'erreur
    if (!docEnded) {
      try { doc.end(); } catch (_) {}
    }
    if (!res.headersSent) {
      res.status(500).json({ message: "Erreur lors de la génération du relevé PDF." });
    }
  }
}

module.exports = generateRelevePDF;
