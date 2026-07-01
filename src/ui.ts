import type { Floor } from './types.js';
import type { Player } from './entities.js';

export function renderHUD(player: Player, floor: Floor): void {
  const hud = document.getElementById('hud')!;
  const weapon = player.equipment.weapon ? player.equipment.weapon.name : 'Fists';
  const armor = player.equipment.armor ? player.equipment.armor.name : 'None';
  hud.innerHTML = [
    `HP ${player.hp}/${player.maxHp}  Lv ${player.level}`,
    `Floor ${floor.depth}`,
    `Weapon: ${weapon}  Armor: ${armor}`,
    '',
  ].join('<br>');
}

export function renderInventory(player: Player, isOpen: boolean): void {
  const panel = document.getElementById('inventory-panel')!;
  panel.classList.toggle('hidden', !isOpen);
  if (!isOpen) return;
  const rows = player.inventory.map((item, i) => {
    const label = item.identified ? `${item.name} (${item.rarity})` : item.name;
    return `${i + 1}. ${label}`;
  });
  panel.innerHTML = `<b>Inventory (i to close, 1-9 to use/equip)</b><br>${rows.join('<br>') || '(empty)'}`;
}

export function renderCombatLog(combatLog: string[]): void {
  document.getElementById('combat-log')!.textContent = combatLog.join('\n');
}

const MINIMAP_TILE_SIZE = 4;

export function renderMinimap(ctx: CanvasRenderingContext2D, floor: Floor, player: Player, explored: Set<string>): void {
  const originX = ctx.canvas.width - MINIMAP_TILE_SIZE * floor.width - 8;
  const originY = 8;
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(
    originX - 4, originY - 4,
    MINIMAP_TILE_SIZE * floor.width + 8, MINIMAP_TILE_SIZE * floor.height + 8,
  );
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (!explored.has(`${x},${y}`)) continue;
      const tile = floor.grid[y * floor.width + x];
      ctx.fillStyle = tile === 0 ? '#222' : '#666';
      ctx.fillRect(originX + x * MINIMAP_TILE_SIZE, originY + y * MINIMAP_TILE_SIZE, MINIMAP_TILE_SIZE - 1, MINIMAP_TILE_SIZE - 1);
    }
  }
  ctx.fillStyle = '#e0d060';
  ctx.fillRect(originX + player.x * MINIMAP_TILE_SIZE, originY + player.y * MINIMAP_TILE_SIZE, MINIMAP_TILE_SIZE - 1, MINIMAP_TILE_SIZE - 1);
}
