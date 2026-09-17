import sharp from 'sharp';
import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync('artifacts/asset-audit/inventory.json'));
const layers=[];
for(let i=0;i<r.length;i++){
  const left=(i%4)*400,top=Math.floor(i/4)*430;
  layers.push({input:await sharp(`artifacts/asset-audit/${r[i].id}-angle.png`).resize(400,400).toBuffer(),left,top});
  layers.push({input:Buffer.from(`<svg width="400" height="30"><rect width="400" height="30" fill="#20232b"/><text x="12" y="22" fill="white" font-size="18">${r[i].id} | ${r[i].source_triangles} triangles</text></svg>`),left,top:top+400});
}
await sharp({create:{width:1600,height:Math.ceil(r.length/4)*430,channels:3,background:'#20232b'}}).composite(layers).png().toFile('artifacts/asset-audit/contact-sheet.png');
