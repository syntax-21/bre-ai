const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../public/admin.css');
let css = fs.readFileSync(cssPath, 'utf8');

const topologyStyles = `
/* Topology Flow Visualizer */
.topology-container {
  background: #090c12;
  background-image: radial-gradient(#1e2536 1px, transparent 1px);
  background-size: 20px 20px;
  border: 1px solid var(--border-card);
  border-radius: var(--radius-lg);
  position: relative;
  height: 340px;
  min-height: 340px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}
.topology-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100% !important;
  height: 100% !important;
  cursor: grab;
  display: block;
}
.topology-canvas:active {
  cursor: grabbing;
}
.topology-controls {
  position: absolute;
  bottom: 14px;
  left: 14px;
  display: flex;
  flex-direction: row;
  gap: 6px;
  z-index: 10;
}
.topo-ctrl-btn {
  width: 28px;
  height: 28px;
  background: #141a26;
  border: 1px solid #232d40;
  color: #cbd5e1;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s;
}
.topo-ctrl-btn:hover {
  background: #1e283b;
  color: #38bdf8;
  border-color: #38bdf8;
}
`;

if (!css.includes('.topology-container')) {
  css += '\n' + topologyStyles;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('Topology styles appended to admin.css successfully');
} else {
  console.log('Topology styles already present in admin.css');
}
