import JSZip from "jszip";

export type ChartPoint = { label: string; value: number; color: string };

const DRAWING_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const CHART_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function nextRid(xml: string): string {
  const ids = [...xml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  return `rId${Math.max(0, ...ids) + 1}`;
}

function sheetTarget(workbookXml: string, relsXml: string, sheetName: string): string | null {
  const tags = [...workbookXml.matchAll(/<sheet\b[^>]*\/>/g)].map((match) => match[0]);
  const tag = tags.find((item) => item.match(/name="([^"]+)"/)?.[1] === sheetName);
  const rid = tag?.match(/\br:id="([^"]+)"/)?.[1];
  if (!rid) return null;
  const rel = [...relsXml.matchAll(/<Relationship\b[^>]*\/>/g)]
    .map((match) => match[0])
    .find((item) => item.includes(`Id="${rid}"`));
  const target = rel?.match(/Target="([^"]+)"/)?.[1];
  if (!target) return null;
  const clean = target.replace(/^\//, "");
  return clean.startsWith("xl/") ? clean : `xl/${clean}`;
}

function chartXml(points: ChartPoint[], startRow: number, endRow: number): string {
  const cats = points
    .map((point, index) => `<c:pt idx="${index}"><c:v>${escapeXml(point.label)}</c:v></c:pt>`)
    .join("");
  const vals = points
    .map((point, index) => `<c:pt idx="${index}"><c:v>${point.value}</c:v></c:pt>`)
    .join("");
  const fills = points
    .map(
      (point, index) =>
        `<c:dPt><c:idx val="${index}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${point.color}"/></a:solidFill></c:spPr></c:dPt>`,
    )
    .join("");
  const ref = `Summary!$A$${startRow}:$A$${endRow}`;
  const values = `Summary!$B$${startRow}:$B$${endRow}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200"/></a:pPr><a:r><a:rPr lang="en-IN" sz="1200" b="1"><a:solidFill><a:srgbClr val="203541"/></a:solidFill></a:rPr><a:t>Spending by category</a:t></a:r></a:p></c:rich></c:tx>
      <c:overlay val="0"/>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:pieChart>
        <c:varyColors val="0"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:tx><c:v>Spent</c:v></c:tx>
          ${fills}
          <c:cat><c:strRef><c:f>${ref}</c:f><c:strCache><c:ptCount val="${points.length}"/>${cats}</c:strCache></c:strRef></c:cat>
          <c:val><c:numRef><c:f>${values}</c:f><c:numCache><c:formatCode>#,##0.00</c:formatCode><c:ptCount val="${points.length}"/>${vals}</c:numCache></c:numRef></c:val>
        </c:ser>
        <c:firstSliceAng val="0"/>
      </c:pieChart>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

function drawingXml(relId: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>16</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>10</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>32</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="2" name="Spending by category"/>
        <xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relId}"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

/** Adds one pie chart to the Summary sheet. Values come from the sheet, with a cache so other spreadsheet apps can draw it. */
export async function injectCategoryChart(buffer: Buffer, points: ChartPoint[], startRow: number, endRow: number): Promise<Buffer> {
  if (points.length === 0 || endRow < startRow) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !relsXml) return buffer;
  const sheetPath = sheetTarget(workbookXml, relsXml, "Summary");
  if (!sheetPath) return buffer;
  let sheetXml = await zip.file(sheetPath)?.async("string");
  if (!sheetXml) return buffer;

  const sheetFile = sheetPath.split("/").pop() ?? "sheet1.xml";
  const relPath = `xl/worksheets/_rels/${sheetFile}.rels`;
  let relXml = (await zip.file(relPath)?.async("string")) ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const drawingRid = nextRid(relXml);
  relXml = relXml.replace(
    "</Relationships>",
    `<Relationship Id="${drawingRid}" Type="${DRAWING_NS}" Target="../drawings/drawing1.xml"/></Relationships>`,
  );

  if (!sheetXml.includes("xmlns:r=")) {
    sheetXml = sheetXml.replace(
      "<worksheet ",
      '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',
    );
  }
  if (!sheetXml.includes("<drawing ")) {
    sheetXml = sheetXml.replace("</worksheet>", `<drawing r:id="${drawingRid}"/></worksheet>`);
  }

  const drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="${CHART_NS}" Target="../charts/chart1.xml"/>
</Relationships>`;

  let types = await zip.file("[Content_Types].xml")?.async("string");
  if (types && !types.includes("/xl/charts/chart1.xml")) {
    types = types.replace(
      "</Types>",
      `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` +
        `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    );
    zip.file("[Content_Types].xml", types);
  }

  zip.file(sheetPath, sheetXml);
  zip.file(relPath, relXml);
  zip.file("xl/drawings/drawing1.xml", drawingXml("rId1"));
  zip.file("xl/drawings/_rels/drawing1.xml.rels", drawingRels);
  zip.file("xl/charts/chart1.xml", chartXml(points, startRow, endRow));
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}
