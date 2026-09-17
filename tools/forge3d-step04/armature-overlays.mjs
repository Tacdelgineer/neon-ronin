import fs from 'node:fs';
import sharp from 'sharp';
for(const name of process.argv.slice(2).length?process.argv.slice(2):['hero','enemy-a','enemy-b']){
  const root='artifacts/asset-audit/',p=JSON.parse(fs.readFileSync(root+name+'-armature-projection.json'));
  const lines=p.bones.map(b=>`<line x1="${b.head[0]}" y1="${b.head[1]}" x2="${b.tail[0]}" y2="${b.tail[1]}" stroke="#50ffa5" stroke-width="3"/><circle cx="${b.head[0]}" cy="${b.head[1]}" r="3" fill="#fff08b"/>`).join('');
  await sharp(root+name+'-equipped-idle.png').composite([{input:Buffer.from(`<svg width="${p.width}" height="${p.height}">${lines}</svg>`)}]).png().toFile(root+name+'-armature.png');
}
