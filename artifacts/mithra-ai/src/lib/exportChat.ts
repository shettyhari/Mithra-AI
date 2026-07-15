export interface ExportableMessage {
  role: string;
  content: string;
  createdAt: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Strip <think>...</think> reasoning blocks so exports contain the final
// answer only, matching what's visible in the transcript by default.
function stripReasoning(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function safeFilename(title: string): string {
  return title.replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-").slice(0, 60) || "conversation";
}

export function exportAsMarkdown(title: string, messages: ExportableMessage[]) {
  const lines = [`# ${title}`, ""];
  for (const m of messages) {
    const who = m.role === "user" ? "**You**" : m.role === "assistant" ? "**Mithra**" : "**System**";
    lines.push(`${who} — _${new Date(m.createdAt).toLocaleString()}_`, "", stripReasoning(m.content), "", "---", "");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  downloadBlob(blob, `${safeFilename(title)}.md`);
}

export async function exportAsPdf(title: string, messages: ExportableMessage[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, marginX, y);
  y += 28;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 56;
    }
  };

  for (const m of messages) {
    const who = m.role === "user" ? "You" : m.role === "assistant" ? "Mithra" : "System";
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${who} · ${new Date(m.createdAt).toLocaleString()}`, marginX, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const text = stripReasoning(m.content);
    const wrapped = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of wrapped) {
      ensureSpace(14);
      doc.text(line, marginX, y);
      y += 14;
    }
    y += 12;
  }

  doc.save(`${safeFilename(title)}.pdf`);
}

export async function exportAsDocx(title: string, messages: ExportableMessage[]) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
  ];

  for (const m of messages) {
    const who = m.role === "user" ? "You" : m.role === "assistant" ? "Mithra" : "System";
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${who} `, bold: true }),
          new TextRun({ text: new Date(m.createdAt).toLocaleString(), italics: true, color: "888888" }),
        ],
        spacing: { before: 200, after: 80 },
      })
    );
    for (const line of stripReasoning(m.content).split("\n")) {
      children.push(new Paragraph({ text: line }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeFilename(title)}.docx`);
}
